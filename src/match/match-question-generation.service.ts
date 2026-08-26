import {
  BadGatewayException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import OpenAI from 'openai';
import { z } from 'zod';
import { MatchQuestion } from './entities/match-question.entity';
import { Tournament } from '../tournament/entities/tournament.entity';

const GeneratedQuestionSchema = z.object({
  text: z.string(),
  rubric: z.string(),
  suggestedMaxScore: z.number().positive(),
});
const GeneratedQuestionsSchema = z.object({
  questions: z.array(GeneratedQuestionSchema),
});

const DEFAULT_TIME_LIMIT_SECONDS = 30;

// Moonshot AI (Kimi) — API compatible con el formato OpenAI. Elegido para el
// MVP a pedido del usuario (tiene API key propia); CLAUDE.md documenta esta
// decisión en la sección del agente evaluador/generador de IA.
const MOONSHOT_BASE_URL = 'https://api.moonshot.ai/v1';
const MOONSHOT_MODEL = 'kimi-k2.6';

const QUESTIONS_JSON_SCHEMA = {
  type: 'object',
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          rubric: { type: 'string' },
          suggestedMaxScore: { type: 'number' },
        },
        required: ['text', 'rubric', 'suggestedMaxScore'],
        additionalProperties: false,
      },
    },
  },
  required: ['questions'],
  additionalProperties: false,
} as const;

@Injectable()
export class MatchQuestionGenerationService {
  constructor(
    @InjectRepository(MatchQuestion)
    private readonly matchQuestionRepository: Repository<MatchQuestion>,
    @InjectRepository(Tournament)
    private readonly tournamentRepository: Repository<Tournament>,
    private readonly configService: ConfigService,
  ) {}

  // Se dispara desde MatchService.schedule() — nunca desde un endpoint
  // propio. Sin banco compartido: cada match genera sus propias
  // `questionsPerMatch` preguntas, evitando repetir texto contra TODO lo ya
  // generado en el evento (otros matches incluidos) — así un jugador que ya
  // jugó no puede filtrarle a otro una pregunta que le va a tocar después.
  // Si el match ya tenía preguntas (reagenda), las tira y genera un set
  // nuevo — regenera siempre, nunca reusa.
  async generateForMatch(
    eventId: string,
    matchId: string,
  ): Promise<MatchQuestion[]> {
    const event = await this.tournamentRepository.findOne({
      where: { id: eventId },
    });
    if (!event) {
      throw new NotFoundException(`Event #${eventId} not found`);
    }

    const existingTexts = await this.matchQuestionRepository
      .createQueryBuilder('mq')
      .innerJoin('matches', 'm', 'm.id = mq.match_id')
      .innerJoin('stages', 's', 's.id = m.stage_id')
      .where('s.event_id = :eventId', { eventId })
      .select('mq.text', 'text')
      .getRawMany<{ text: string }>();

    const generated = await this.callAi(
      event.theme,
      event.questionsPerMatch,
      existingTexts.map((row) => row.text),
    );
    const scaledScores = this.normalizeScores(
      generated.map((question) => question.suggestedMaxScore),
      Number(event.maxScorePerMatch),
    );

    await this.matchQuestionRepository.delete({ matchId });

    const questions = generated.map((question, index) =>
      this.matchQuestionRepository.create({
        matchId,
        position: index + 1,
        text: question.text,
        rubric: question.rubric,
        maxScore: scaledScores[index],
        timeLimit: DEFAULT_TIME_LIMIT_SECONDS,
      }),
    );
    return this.matchQuestionRepository.save(questions);
  }

  private async callAi(
    theme: string,
    count: number,
    existingTexts: string[],
  ): Promise<z.infer<typeof GeneratedQuestionSchema>[]> {
    const apiKey = this.configService.getOrThrow<string>('MOONSHOT_API_KEY');
    const client = new OpenAI({ apiKey, baseURL: MOONSHOT_BASE_URL });

    const avoidList = existingTexts.length
      ? `Preguntas que YA existen para este evento, en otros matches (no las repitas ni generes variantes obvias — un jugador que ya las respondió podría filtrárselas a otro):\n${existingTexts
          .map((text) => `- ${text}`)
          .join('\n')}\n\n`
      : '';

    let content: string | null;
    try {
      const response = await client.chat.completions.create({
        model: MOONSHOT_MODEL,
        messages: [
          {
            role: 'system',
            content:
              'Sos un generador de preguntas de trivia para un torneo de conocimiento tipo ' +
              'mata-mata competitivo. Nivel de dificultad: DIFÍCIL — es una competencia, las ' +
              'preguntas deben exigir conocimiento real y específico, no trivia superficial. ' +
              'Cada pregunta se responde en texto libre (no opción múltiple) y la evalúa después ' +
              'una IA contra la rúbrica que generes, así que la rúbrica tiene que describir ' +
              'claramente qué debe contener una respuesta correcta (puntos clave esperados, no ' +
              'solo "la respuesta es X"). Escribí todo en español.',
          },
          {
            role: 'user',
            content:
              `${avoidList}Generá exactamente ${count} preguntas nuevas, difíciles, sobre el ` +
              `tema "${theme}", de dificultad variada entre ellas (todas difíciles, pero no ` +
              'idénticas en exigencia), con un puntaje sugerido (número positivo) proporcional ' +
              'a esa dificultad relativa.',
          },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'generated_questions',
            schema: QUESTIONS_JSON_SCHEMA,
          },
        },
      });
      content = response.choices[0]?.message?.content ?? null;
    } catch {
      throw new BadGatewayException(
        'AI question generation failed — try again',
      );
    }

    if (!content) {
      throw new BadGatewayException(
        'AI question generation failed — try again',
      );
    }

    let parsed: z.infer<typeof GeneratedQuestionsSchema>;
    try {
      parsed = GeneratedQuestionsSchema.parse(JSON.parse(content));
    } catch {
      throw new BadGatewayException(
        'AI returned an unexpected format — try again',
      );
    }

    if (parsed.questions.length !== count) {
      throw new BadGatewayException(
        'AI question generation failed — try again',
      );
    }
    return parsed.questions;
  }

  // Reescala los puntajes sugeridos por la IA para que sumen EXACTO
  // maxScorePerMatch del evento — es el denominador de la normalización 0-100
  // de la fórmula de scoring (ver CLAUDE.md).
  private normalizeScores(raw: number[], targetTotal: number): number[] {
    const rawTotal = raw.reduce((sum, value) => sum + value, 0);
    const scale = targetTotal / rawTotal;
    const scaled = raw.map((value) => round2(value * scale));

    const scaledTotal = scaled.reduce((sum, value) => sum + value, 0);
    const remainder = round2(targetTotal - scaledTotal);
    scaled[scaled.length - 1] = round2(scaled[scaled.length - 1] + remainder);
    return scaled;
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

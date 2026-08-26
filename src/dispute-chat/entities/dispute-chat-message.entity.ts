import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('dispute_chat_messages')
export class DisputeChatMessage {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'match_id' })
  matchId!: string;

  // Optional — the dispute can be about a specific question or general to the match.
  @Column({ type: 'uuid', name: 'question_id', nullable: true })
  questionId!: string | null;

  @Column({ type: 'uuid', name: 'author_id' })
  authorId!: string;

  @Column({ type: 'text' })
  text!: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}

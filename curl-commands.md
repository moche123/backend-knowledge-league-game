# Liga del Saber — API curl reference

Ejemplos `curl` para cada endpoint implementado. Reemplazá los placeholders (`PASTE_..._HERE`) por valores reales — la mayoría de los flujos empiezan con `POST /auth/login` para conseguir el `accessToken`.

> Se actualiza cada vez que se agrega o cambia un endpoint — más confiable que cualquier resumen en prosa si llegan a no coincidir.

## Índice

- [Authentication](#authentication)
- [Tournament](#tournament)
- [Registrations](#registrations)
- [Stages / Bracket](#stages--bracket)
- [Matches](#matches)
- [Dispute Chat](#dispute-chat)
- [Ranking](#ranking)
- [Admin Override (Fase 10)](#admin-override-fase-10)

---

## Authentication

#### Login

```bash
curl --data "email=PASTE_EMAIL_HERE&password=PASTE_PASSWORD_HERE" \
  http://localhost:3000/auth/login
```

#### Register

Siempre crea rol `player` — el primer admin se bootstrapea a mano en la DB.

```bash
curl --data "name=PASTE_NAME_HERE&email=PASTE_EMAIL_HERE&password=PASTE_PASSWORD_HERE" \
  http://localhost:3000/auth/register
```

#### Refresh token

Usa el `refreshToken` devuelto por login/register. Rota en cada uso — el viejo deja de servir.

```bash
curl --data "refreshToken=PASTE_REFRESH_TOKEN_HERE" \
  http://localhost:3000/auth/refresh
```

#### Logout

Requiere el `accessToken` vigente — invalida el refresh token guardado.

```bash
curl -X POST -H "Authorization: Bearer PASTE_ACCESS_TOKEN_HERE" \
  http://localhost:3000/auth/logout
```

## Tournament

#### Create event — admin

```bash
curl -X POST -H "Content-Type: application/json" \
  -H "Authorization: Bearer PASTE_ACCESS_TOKEN_HERE" \
  -d '{"name":"Copa Saber","theme":"historia","startDate":"2026-09-01T00:00:00Z","endDate":"2026-09-15T00:00:00Z","maxPlayers":8,"questionsPerMatch":5}' \
  http://localhost:3000/tournament/events
```

#### List events — autenticado

```bash
curl -H "Authorization: Bearer PASTE_ACCESS_TOKEN_HERE" \
  http://localhost:3000/tournament/events
```

#### Get event by id — autenticado

```bash
curl -H "Authorization: Bearer PASTE_ACCESS_TOKEN_HERE" \
  http://localhost:3000/tournament/events/PASTE_EVENT_ID_HERE
```

#### Update event — admin, partial

```bash
curl -X PATCH -H "Content-Type: application/json" \
  -H "Authorization: Bearer PASTE_ACCESS_TOKEN_HERE" \
  -d '{"status":"in_progress"}' \
  http://localhost:3000/tournament/events/PASTE_EVENT_ID_HERE
```

#### Delete event — admin

```bash
curl -X DELETE -H "Authorization: Bearer PASTE_ACCESS_TOKEN_HERE" \
  http://localhost:3000/tournament/events/PASTE_EVENT_ID_HERE
```

## Registrations

#### Register self — jugador se inscribe

```bash
curl -X POST -H "Authorization: Bearer PASTE_ACCESS_TOKEN_HERE" \
  http://localhost:3000/tournament/events/PASTE_EVENT_ID_HERE/registrations
```

#### List registrations — autenticado

```bash
curl -H "Authorization: Bearer PASTE_ACCESS_TOKEN_HERE" \
  http://localhost:3000/tournament/events/PASTE_EVENT_ID_HERE/registrations
```

#### Unregister self

Solo mientras el evento sigue `registration_open`.

```bash
curl -X DELETE -H "Authorization: Bearer PASTE_ACCESS_TOKEN_HERE" \
  http://localhost:3000/tournament/events/PASTE_EVENT_ID_HERE/registrations/me
```

#### Admin registers a player

```bash
curl -X POST -H "Authorization: Bearer PASTE_ACCESS_TOKEN_HERE" \
  http://localhost:3000/tournament/events/PASTE_EVENT_ID_HERE/registrations/PASTE_USER_ID_HERE
```

#### Admin unregisters a player

```bash
curl -X DELETE -H "Authorization: Bearer PASTE_ACCESS_TOKEN_HERE" \
  http://localhost:3000/tournament/events/PASTE_EVENT_ID_HERE/registrations/PASTE_USER_ID_HERE
```

## Stages / Bracket

#### Draw — admin

Cierra inscripción, arma el árbol completo de fases y sortea la primera (requiere exactamente `maxPlayers` inscritos).

```bash
curl -X POST -H "Authorization: Bearer PASTE_ACCESS_TOKEN_HERE" \
  http://localhost:3000/tournament/events/PASTE_EVENT_ID_HERE/stages/draw
```

#### List stages + matches — autenticado

Ver el bracket completo.

```bash
curl -H "Authorization: Bearer PASTE_ACCESS_TOKEN_HERE" \
  http://localhost:3000/tournament/events/PASTE_EVENT_ID_HERE/stages
```

> Las fases siguientes (semis, final, 3er puesto) se sortean solas — cuando cierra la última partida pendiente de una fase, aparecen matches `pending` nuevos en la fase siguiente al volver a pedir este mismo `GET`. Sin endpoint nuevo, es automático.

## Matches

#### Get match — autenticado

```bash
curl -H "Authorization: Bearer PASTE_ACCESS_TOKEN_HERE" \
  http://localhost:3000/tournament/events/PASTE_EVENT_ID_HERE/matches/PASTE_MATCH_ID_HERE
```

> Trae `score_a`/`score_b`/`winner_id` ya calculados (fórmula 70/30) una vez que el match cierra (`closed` o `walkover`) — sin endpoint nuevo, es automático.

#### Schedule / reagendar match — admin

Fija hora de inicio y fin estimada. Genera (o **regenera**, si ya tenía) las preguntas de ESTE match por IA (Moonshot) al vuelo — requiere `MOONSHOT_API_KEY` en `.env`.

```bash
curl -X PATCH -H "Content-Type: application/json" \
  -H "Authorization: Bearer PASTE_ACCESS_TOKEN_HERE" \
  -d '{"scheduledStartAt":"2026-09-01T15:00:00Z","scheduledEndAt":"2026-09-01T15:30:00Z"}' \
  http://localhost:3000/tournament/events/PASTE_EVENT_ID_HERE/matches/PASTE_MATCH_ID_HERE/schedule
```

#### Edit participants — admin

Cambia uno o los dos jugadores, solo mientras el match sigue `pending`.

```bash
curl -X PATCH -H "Content-Type: application/json" \
  -H "Authorization: Bearer PASTE_ACCESS_TOKEN_HERE" \
  -d '{"playerAId":"PASTE_USER_ID_HERE"}' \
  http://localhost:3000/tournament/events/PASTE_EVENT_ID_HERE/matches/PASTE_MATCH_ID_HERE/participants
```

#### Start match — admin o árbitro

Falla si todavía no llegó `scheduledStartAt`, o si el match no tiene preguntas generadas (reagendalo primero).

```bash
curl -X POST -H "Authorization: Bearer PASTE_ACCESS_TOKEN_HERE" \
  http://localhost:3000/tournament/events/PASTE_EVENT_ID_HERE/matches/PASTE_MATCH_ID_HERE/start
```

#### End match — admin o árbitro

Puede cerrarlo antes de lo estimado.

```bash
curl -X POST -H "Authorization: Bearer PASTE_ACCESS_TOKEN_HERE" \
  http://localhost:3000/tournament/events/PASTE_EVENT_ID_HERE/matches/PASTE_MATCH_ID_HERE/end
```

#### Get current question — jugador, solo los 2 del match

Pregunta activa + deadline, sin rúbrica.

```bash
curl -H "Authorization: Bearer PASTE_ACCESS_TOKEN_HERE" \
  http://localhost:3000/tournament/events/PASTE_EVENT_ID_HERE/matches/PASTE_MATCH_ID_HERE/current-question
```

#### Submit answer — jugador, solo los 2 del match

Responde la pregunta activa.

```bash
curl -X POST -H "Content-Type: application/json" \
  -H "Authorization: Bearer PASTE_ACCESS_TOKEN_HERE" \
  -d '{"answerText":"1969"}' \
  http://localhost:3000/tournament/events/PASTE_EVENT_ID_HERE/matches/PASTE_MATCH_ID_HERE/answers
```

#### Get answers

Participantes solo tras cerrar el match; admin/árbitro en cualquier momento. Trae `ai_score`/`ai_justification`, evaluados por IA (Moonshot) apenas se deja atrás cada pregunta.

```bash
curl -H "Authorization: Bearer PASTE_ACCESS_TOKEN_HERE" \
  http://localhost:3000/tournament/events/PASTE_EVENT_ID_HERE/matches/PASTE_MATCH_ID_HERE/answers
```

#### List match questions — admin o árbitro

Cuestionario completo del match, con rúbrica.

```bash
curl -H "Authorization: Bearer PASTE_ACCESS_TOKEN_HERE" \
  http://localhost:3000/tournament/events/PASTE_EVENT_ID_HERE/matches/PASTE_MATCH_ID_HERE/questions
```

#### Get match question by id — admin o árbitro

```bash
curl -H "Authorization: Bearer PASTE_ACCESS_TOKEN_HERE" \
  http://localhost:3000/tournament/events/PASTE_EVENT_ID_HERE/matches/PASTE_MATCH_ID_HERE/questions/PASTE_QUESTION_ID_HERE
```

#### Update match question — admin, partial

Corrección de contenido, solo mientras el match sigue `pending`.

```bash
curl -X PATCH -H "Content-Type: application/json" \
  -H "Authorization: Bearer PASTE_ACCESS_TOKEN_HERE" \
  -d '{"rubric":"Respuesta esperada: 1969, aceptar también \"año 69\"."}' \
  http://localhost:3000/tournament/events/PASTE_EVENT_ID_HERE/matches/PASTE_MATCH_ID_HERE/questions/PASTE_QUESTION_ID_HERE
```

## Dispute Chat

#### Send message

Jugadores del match, árbitro del evento, o admin. `questionId` opcional, para reclamar sobre una pregunta puntual.

```bash
curl -X POST -H "Content-Type: application/json" \
  -H "Authorization: Bearer PASTE_ACCESS_TOKEN_HERE" \
  -d '{"text":"No estoy de acuerdo con el puntaje de esta pregunta"}' \
  http://localhost:3000/tournament/events/PASTE_EVENT_ID_HERE/matches/PASTE_MATCH_ID_HERE/chat
```

```bash
curl -X POST -H "Content-Type: application/json" \
  -H "Authorization: Bearer PASTE_ACCESS_TOKEN_HERE" \
  -d '{"text":"Mi respuesta mencionaba el punto clave, revisar","questionId":"PASTE_QUESTION_ID_HERE"}' \
  http://localhost:3000/tournament/events/PASTE_EVENT_ID_HERE/matches/PASTE_MATCH_ID_HERE/chat
```

#### List messages — mismos participantes

```bash
curl -H "Authorization: Bearer PASTE_ACCESS_TOKEN_HERE" \
  http://localhost:3000/tournament/events/PASTE_EVENT_ID_HERE/matches/PASTE_MATCH_ID_HERE/chat
```

## Ranking

#### Global leaderboard — autenticado

Suma de puntos de todos los eventos.

```bash
curl -H "Authorization: Bearer PASTE_ACCESS_TOKEN_HERE" \
  http://localhost:3000/ranking
```

#### Event leaderboard — autenticado

```bash
curl -H "Authorization: Bearer PASTE_ACCESS_TOKEN_HERE" \
  http://localhost:3000/ranking/events/PASTE_EVENT_ID_HERE
```

## Admin Override (Fase 10)

#### Override answer score — admin

Solo en match `closed`/`walkover` — recalcula el resultado del match y el ranking.

```bash
curl -X PATCH -H "Content-Type: application/json" \
  -H "Authorization: Bearer PASTE_ACCESS_TOKEN_HERE" \
  -d '{"score":15,"reason":"La respuesta mencionaba el punto clave que la IA no detectó, según lo discutido en el chat"}' \
  http://localhost:3000/tournament/events/PASTE_EVENT_ID_HERE/matches/PASTE_MATCH_ID_HERE/answers/PASTE_ANSWER_ID_HERE/override
```

#### Reopen match — admin

Repite el match desde cero (ej. plagio detectado post-match): vuelve a `pending`, borra respuestas/preguntas/puntaje/ranking de ese match.

```bash
curl -X POST -H "Content-Type: application/json" \
  -H "Authorization: Bearer PASTE_ACCESS_TOKEN_HERE" \
  -d '{"reason":"Plagio detectado en la respuesta del jugador A, se reabre para sustituirlo"}' \
  http://localhost:3000/tournament/events/PASTE_EVENT_ID_HERE/matches/PASTE_MATCH_ID_HERE/reopen
```

> Después de reabrir: usar `PATCH .../participants` (ya desbloqueado, vuelve a `pending`) para sustituir al jugador descalificado, y `PATCH .../schedule` para reagendar (regenera preguntas nuevas).

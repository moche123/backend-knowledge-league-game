# Know League — API curl reference

`curl` examples for every implemented endpoint. Replace the placeholders (`PASTE_..._HERE`) with real values — most flows start with `POST /auth/login` to get the `accessToken`.

> Updated every time an endpoint is added or changed — more trustworthy than any prose summary if they ever disagree.

## Index

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

Always creates role `player` — the first admin is bootstrapped by hand in the DB.

```bash
curl --data "name=PASTE_NAME_HERE&email=PASTE_EMAIL_HERE&password=PASTE_PASSWORD_HERE" \
  http://localhost:3000/auth/register
```

#### Refresh token

Uses the `refreshToken` returned by login/register. Rotates on every use — the old one stops working.

```bash
curl --data "refreshToken=PASTE_REFRESH_TOKEN_HERE" \
  http://localhost:3000/auth/refresh
```

#### Logout

Requires the current `accessToken` — invalidates the stored refresh token.

```bash
curl -X POST -H "Authorization: Bearer PASTE_ACCESS_TOKEN_HERE" \
  http://localhost:3000/auth/logout
```

## Tournament

#### Create event — admin

```bash
curl -X POST -H "Content-Type: application/json" \
  -H "Authorization: Bearer PASTE_ACCESS_TOKEN_HERE" \
  -d '{"name":"Copa Saber","theme":"history","startDate":"2026-09-01T00:00:00Z","endDate":"2026-09-15T00:00:00Z","maxPlayers":8,"questionsPerMatch":5}' \
  http://localhost:3000/tournament/events
```

#### List events — authenticated

```bash
curl -H "Authorization: Bearer PASTE_ACCESS_TOKEN_HERE" \
  http://localhost:3000/tournament/events
```

#### Get event by id — authenticated

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

#### Register self — player registers themself

```bash
curl -X POST -H "Authorization: Bearer PASTE_ACCESS_TOKEN_HERE" \
  http://localhost:3000/tournament/events/PASTE_EVENT_ID_HERE/registrations
```

#### List registrations — authenticated

```bash
curl -H "Authorization: Bearer PASTE_ACCESS_TOKEN_HERE" \
  http://localhost:3000/tournament/events/PASTE_EVENT_ID_HERE/registrations
```

#### Unregister self

Only while the event is still `registration_open`.

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

Closes registration, builds the full stage tree, and draws the first one (requires exactly `maxPlayers` registered).

```bash
curl -X POST -H "Authorization: Bearer PASTE_ACCESS_TOKEN_HERE" \
  http://localhost:3000/tournament/events/PASTE_EVENT_ID_HERE/stages/draw
```

#### List stages + matches — authenticated

View the full bracket.

```bash
curl -H "Authorization: Bearer PASTE_ACCESS_TOKEN_HERE" \
  http://localhost:3000/tournament/events/PASTE_EVENT_ID_HERE/stages
```

> Later stages (semis, final, third place) draw themselves — when a stage's last pending match closes, new `pending` matches appear in the next stage the next time you call this same `GET`. No new endpoint, it's automatic.

## Matches

#### Get match — authenticated

```bash
curl -H "Authorization: Bearer PASTE_ACCESS_TOKEN_HERE" \
  http://localhost:3000/tournament/events/PASTE_EVENT_ID_HERE/matches/PASTE_MATCH_ID_HERE
```

> Includes `score_a`/`score_b`/`winner_id` already computed (70/30 formula) once the match closes (`closed` or `walkover`) — no new endpoint, it's automatic.

#### Schedule / reschedule match — admin

Sets the estimated start and end time. Generates (or **regenerates**, if it already had one) this match's questions via AI (Moonshot) on the fly — requires `MOONSHOT_API_KEY` in `.env`. Also **auto-assigns a referee**: a random pick (no AI) among referees with no other match overlapping this window — re-rolled on every (re)schedule. Left `null` if none is free; check the response's `refereeId`.

```bash
curl -X PATCH -H "Content-Type: application/json" \
  -H "Authorization: Bearer PASTE_ACCESS_TOKEN_HERE" \
  -d '{"scheduledStartAt":"2026-09-01T15:00:00Z","scheduledEndAt":"2026-09-01T15:30:00Z"}' \
  http://localhost:3000/tournament/events/PASTE_EVENT_ID_HERE/matches/PASTE_MATCH_ID_HERE/schedule
```

#### List referees available for a match — admin

Referees free for this match's current scheduled window (must be scheduled first) — used to populate a "change referee" picker.

```bash
curl -H "Authorization: Bearer PASTE_ACCESS_TOKEN_HERE" \
  http://localhost:3000/tournament/events/PASTE_EVENT_ID_HERE/matches/PASTE_MATCH_ID_HERE/referees/available
```

#### Override the assigned referee — admin

Picks a specific referee (should come from the list above). Returns 409 if that referee actually has another match overlapping this window (race).

```bash
curl -X PATCH -H "Content-Type: application/json" \
  -H "Authorization: Bearer PASTE_ACCESS_TOKEN_HERE" \
  -d '{"refereeId":"PASTE_REFEREE_ID_HERE"}' \
  http://localhost:3000/tournament/events/PASTE_EVENT_ID_HERE/matches/PASTE_MATCH_ID_HERE/referee
```

#### Edit participants — admin

Changes one or both players, only while the match is still `pending`.

```bash
curl -X PATCH -H "Content-Type: application/json" \
  -H "Authorization: Bearer PASTE_ACCESS_TOKEN_HERE" \
  -d '{"playerAId":"PASTE_USER_ID_HERE"}' \
  http://localhost:3000/tournament/events/PASTE_EVENT_ID_HERE/matches/PASTE_MATCH_ID_HERE/participants
```

#### Start match — admin or referee

Fails if `scheduledStartAt` hasn't arrived yet, or if the match has no generated questions (reschedule it first).

```bash
curl -X POST -H "Authorization: Bearer PASTE_ACCESS_TOKEN_HERE" \
  http://localhost:3000/tournament/events/PASTE_EVENT_ID_HERE/matches/PASTE_MATCH_ID_HERE/start
```

#### End match — admin or referee

Can close it earlier than estimated.

```bash
curl -X POST -H "Authorization: Bearer PASTE_ACCESS_TOKEN_HERE" \
  http://localhost:3000/tournament/events/PASTE_EVENT_ID_HERE/matches/PASTE_MATCH_ID_HERE/end
```

#### Get current question — player, only the match's 2

Active question + deadline, without the rubric.

```bash
curl -H "Authorization: Bearer PASTE_ACCESS_TOKEN_HERE" \
  http://localhost:3000/tournament/events/PASTE_EVENT_ID_HERE/matches/PASTE_MATCH_ID_HERE/current-question
```

#### Submit answer — player, only the match's 2

Answers the active question.

```bash
curl -X POST -H "Content-Type: application/json" \
  -H "Authorization: Bearer PASTE_ACCESS_TOKEN_HERE" \
  -d '{"answerText":"1969"}' \
  http://localhost:3000/tournament/events/PASTE_EVENT_ID_HERE/matches/PASTE_MATCH_ID_HERE/answers
```

#### Get answers

Participants only after the match closes; admin/referee any time. Includes `ai_score`/`ai_justification`, evaluated by AI (Moonshot) as soon as each question is left behind.

```bash
curl -H "Authorization: Bearer PASTE_ACCESS_TOKEN_HERE" \
  http://localhost:3000/tournament/events/PASTE_EVENT_ID_HERE/matches/PASTE_MATCH_ID_HERE/answers
```

#### List match questions — admin or referee

The match's full question set, with rubric.

```bash
curl -H "Authorization: Bearer PASTE_ACCESS_TOKEN_HERE" \
  http://localhost:3000/tournament/events/PASTE_EVENT_ID_HERE/matches/PASTE_MATCH_ID_HERE/questions
```

#### Get match question by id — admin or referee

```bash
curl -H "Authorization: Bearer PASTE_ACCESS_TOKEN_HERE" \
  http://localhost:3000/tournament/events/PASTE_EVENT_ID_HERE/matches/PASTE_MATCH_ID_HERE/questions/PASTE_QUESTION_ID_HERE
```

#### Update match question — admin, partial

Content correction, only while the match is still `pending`.

```bash
curl -X PATCH -H "Content-Type: application/json" \
  -H "Authorization: Bearer PASTE_ACCESS_TOKEN_HERE" \
  -d '{"rubric":"Expected answer: 1969, also accept \"year 69\"."}' \
  http://localhost:3000/tournament/events/PASTE_EVENT_ID_HERE/matches/PASTE_MATCH_ID_HERE/questions/PASTE_QUESTION_ID_HERE
```

## Dispute Chat

#### Send message

Match players, event referee, or admin. `questionId` optional, for a dispute about one specific question.

```bash
curl -X POST -H "Content-Type: application/json" \
  -H "Authorization: Bearer PASTE_ACCESS_TOKEN_HERE" \
  -d '{"text":"I disagree with the score on this question"}' \
  http://localhost:3000/tournament/events/PASTE_EVENT_ID_HERE/matches/PASTE_MATCH_ID_HERE/chat
```

```bash
curl -X POST -H "Content-Type: application/json" \
  -H "Authorization: Bearer PASTE_ACCESS_TOKEN_HERE" \
  -d '{"text":"My answer mentioned the key point, please review","questionId":"PASTE_QUESTION_ID_HERE"}' \
  http://localhost:3000/tournament/events/PASTE_EVENT_ID_HERE/matches/PASTE_MATCH_ID_HERE/chat
```

#### List messages — same participants

```bash
curl -H "Authorization: Bearer PASTE_ACCESS_TOKEN_HERE" \
  http://localhost:3000/tournament/events/PASTE_EVENT_ID_HERE/matches/PASTE_MATCH_ID_HERE/chat
```

## Ranking

#### Global leaderboard — authenticated

Sum of points across all events.

```bash
curl -H "Authorization: Bearer PASTE_ACCESS_TOKEN_HERE" \
  http://localhost:3000/ranking
```

#### Event leaderboard — authenticated

```bash
curl -H "Authorization: Bearer PASTE_ACCESS_TOKEN_HERE" \
  http://localhost:3000/ranking/events/PASTE_EVENT_ID_HERE
```

## Admin Override (Fase 10)

#### Override answer score — admin

Only on a `closed`/`walkover` match — recalculates the match result and the ranking.

```bash
curl -X PATCH -H "Content-Type: application/json" \
  -H "Authorization: Bearer PASTE_ACCESS_TOKEN_HERE" \
  -d '{"score":15,"reason":"The answer mentioned the key point the AI missed, per the dispute chat discussion"}' \
  http://localhost:3000/tournament/events/PASTE_EVENT_ID_HERE/matches/PASTE_MATCH_ID_HERE/answers/PASTE_ANSWER_ID_HERE/override
```

#### Reopen match — admin

Repeats the match from scratch (e.g. plagiarism detected post-match): goes back to `pending`, clears answers/questions/score/ranking for that match.

```bash
curl -X POST -H "Content-Type: application/json" \
  -H "Authorization: Bearer PASTE_ACCESS_TOKEN_HERE" \
  -d '{"reason":"Plagiarism detected in player A answer, reopening to substitute them"}' \
  http://localhost:3000/tournament/events/PASTE_EVENT_ID_HERE/matches/PASTE_MATCH_ID_HERE/reopen
```

> After reopening: use `PATCH .../participants` (unlocked again, back to `pending`) to substitute the disqualified player, and `PATCH .../schedule` to reschedule it (regenerates new questions).

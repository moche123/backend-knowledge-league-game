
## AUTHENTICATION --

### LOGIN 

curl --data "email=carlos@gmail.com&password=12345678" http://localhost:3000/auth/login (ADMIN)
curl --data "email=cesar@gmail.com&password=12345678" http://localhost:3000/auth/login
curl --data "email=luis@gmail.com&password=12345678" http://localhost:3000/auth/login

### REGISTER 

curl --data "name=Carlos&email=carlos@gmail.com&password=12345678" http://localhost:3000/auth/register


### REFRESH TOKEN (usa el refreshToken devuelto por login/register)

curl --data "refreshToken=PASTE_REFRESH_TOKEN_HERE" http://localhost:3000/auth/refresh

### LOGOUT (requiere el accessToken vigente, invalida el refresh token guardado)

curl -X POST -H "Authorization: Bearer PASTE_ACCESS_TOKEN_HERE" http://localhost:3000/auth/logout

## TOURNAMENT

### CREATE EVENT (admin)

curl -X POST -H "Content-Type: application/json" -H "Authorization: Bearer PASTE_ACCESS_TOKEN_HERE" -d '{"name":"Copa Saber","theme":"historia","startDate":"2026-09-01T00:00:00Z","endDate":"2026-09-15T00:00:00Z","maxPlayers":8,"questionsPerMatch":5}' http://localhost:3000/tournament/events

### LIST EVENTS (autenticado)

curl -H "Authorization: Bearer PASTE_ACCESS_TOKEN_HERE" http://localhost:3000/tournament/events

### GET EVENT BY ID (autenticado)

curl -H "Authorization: Bearer PASTE_ACCESS_TOKEN_HERE" http://localhost:3000/tournament/events/PASTE_EVENT_ID_HERE

### UPDATE EVENT (admin, partial)

curl -X PATCH -H "Content-Type: application/json" -H "Authorization: Bearer PASTE_ACCESS_TOKEN_HERE" -d '{"status":"in_progress"}' http://localhost:3000/tournament/events/PASTE_EVENT_ID_HERE

### DELETE EVENT (admin)

curl -X DELETE -H "Authorization: Bearer PASTE_ACCESS_TOKEN_HERE" http://localhost:3000/tournament/events/PASTE_EVENT_ID_HERE

## REGISTRATIONS --

### REGISTER SELF (jugador se inscribe)

curl -X POST -H "Authorization: Bearer PASTE_ACCESS_TOKEN_HERE" http://localhost:3000/tournament/events/PASTE_EVENT_ID_HERE/registrations


curl -X POST -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxNTU0NTBmYS0xYTFkLTQ0M2EtOWQzNC00NjIzZTY2YjA2NDYiLCJlbWFpbCI6ImNhcmxvc0BnbWFpbC5jb20iLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3ODc2NzU5NjQsImV4cCI6MTc4Nzc2MjM2NH0.bYwp-R7yuu5HHVV-uR45AM-vaCLOmndVY34ERN2M5Zs" http://localhost:3000/tournament/events/79ff6494-9b26-440e-8d1a-d32a36edd643/registrations

### LIST REGISTRATIONS (autenticado)

curl -H "Authorization: Bearer PASTE_ACCESS_TOKEN_HERE" http://localhost:3000/tournament/events/PASTE_EVENT_ID_HERE/registrations

curl -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZmRiMjU5MC03ZTBjLTRiMjQtYTg5Yy04ZTg1MzYzODA3NTQiLCJlbWFpbCI6Imx1aXNAZ21haWwuY29tIiwicm9sZSI6InBsYXllciIsImlhdCI6MTc4NzY3NTQ2MywiZXhwIjoxNzg3NzYxODYzfQ.NA4hyzzclznUuNvMq3EdsU6uXJTXbWcnBvZuqU0IjG4" http://localhost:3000/tournament/events/79ff6494-9b26-440e-8d1a-d32a36edd643/registrations

### UNREGISTER SELF (jugador se da de baja, solo si el evento sigue registration_open)

curl -X DELETE -H "Authorization: Bearer PASTE_ACCESS_TOKEN_HERE" http://localhost:3000/tournament/events/PASTE_EVENT_ID_HERE/registrations/me


curl -X DELETE -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZmRiMjU5MC03ZTBjLTRiMjQtYTg5Yy04ZTg1MzYzODA3NTQiLCJlbWFpbCI6Imx1aXNAZ21haWwuY29tIiwicm9sZSI6InBsYXllciIsImlhdCI6MTc4NzY3NTQ2MywiZXhwIjoxNzg3NzYxODYzfQ.NA4hyzzclznUuNvMq3EdsU6uXJTXbWcnBvZuqU0IjG4" http://localhost:3000/tournament/events/79ff6494-9b26-440e-8d1a-d32a36edd643/registrations/me

### ADMIN REGISTERS A PLAYER

curl -X POST -H "Authorization: Bearer PASTE_ACCESS_TOKEN_HERE" http://localhost:3000/tournament/events/PASTE_EVENT_ID_HERE/registrations/PASTE_USER_ID_HERE


curl -X POST -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxNTU0NTBmYS0xYTFkLTQ0M2EtOWQzNC00NjIzZTY2YjA2NDYiLCJlbWFpbCI6ImNhcmxvc0BnbWFpbC5jb20iLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3ODc2NzYwOTgsImV4cCI6MTc4Nzc2MjQ5OH0.1nDXHj1b6JKhl98Aj1C0-64Cs1VN0rZe936L6aMr4AA" http://localhost:3000/tournament/events/79ff6494-9b26-440e-8d1a-d32a36edd643/registrations/7fdb2590-7e0c-4b24-a89c-8e8536380754



### ADMIN UNREGISTERS A PLAYER

curl -X DELETE -H "Authorization: Bearer PASTE_ACCESS_TOKEN_HERE" http://localhost:3000/tournament/events/PASTE_EVENT_ID_HERE/registrations/PASTE_USER_ID_HERE

curl -X DELETE -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxNTU0NTBmYS0xYTFkLTQ0M2EtOWQzNC00NjIzZTY2YjA2NDYiLCJlbWFpbCI6ImNhcmxvc0BnbWFpbC5jb20iLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3ODc2NzYwOTgsImV4cCI6MTc4Nzc2MjQ5OH0.1nDXHj1b6JKhl98Aj1C0-64Cs1VN0rZe936L6aMr4AA" http://localhost:3000/tournament/events/79ff6494-9b26-440e-8d1a-d32a36edd643/registrations/f602dd80-6412-4a02-9928-94fb05bb3018

## STAGES / BRACKET

### DRAW (admin) — cierra inscripción, arma el árbol de fases y sortea la primera (requiere exactamente maxPlayers inscritos)

curl -X POST -H "Authorization: Bearer PASTE_ACCESS_TOKEN_HERE" http://localhost:3000/tournament/events/PASTE_EVENT_ID_HERE/stages/draw

### LIST STAGES + MATCHES (autenticado) — ver el bracket

curl -H "Authorization: Bearer PASTE_ACCESS_TOKEN_HERE" http://localhost:3000/tournament/events/PASTE_EVENT_ID_HERE/stages

### Nota: las fases siguientes (semis, final, 3er puesto) se sortean solas — cuando cierra la última partida pendiente de una fase, aparecen matches PENDING nuevos en la fase siguiente al volver a pedir este mismo GET. Sin endpoint nuevo, es automático.

## MATCHES

### GET MATCH (autenticado)

curl -H "Authorization: Bearer PASTE_ACCESS_TOKEN_HERE" http://localhost:3000/tournament/events/PASTE_EVENT_ID_HERE/matches/PASTE_MATCH_ID_HERE

### SCHEDULE / REAGENDAR MATCH (admin) — fija hora de inicio y fin estimada. Genera (o REGENERA, si ya tenía) las preguntas de ESTE match por IA (Moonshot) al vuelo — requiere MOONSHOT_API_KEY en .env

curl -X PATCH -H "Content-Type: application/json" -H "Authorization: Bearer PASTE_ACCESS_TOKEN_HERE" -d '{"scheduledStartAt":"2026-09-01T15:00:00Z","scheduledEndAt":"2026-09-01T15:30:00Z"}' http://localhost:3000/tournament/events/PASTE_EVENT_ID_HERE/matches/PASTE_MATCH_ID_HERE/schedule

### EDIT PARTICIPANTS (admin) — cambia uno o los dos jugadores, solo mientras el match sigue pending

curl -X PATCH -H "Content-Type: application/json" -H "Authorization: Bearer PASTE_ACCESS_TOKEN_HERE" -d '{"playerAId":"PASTE_USER_ID_HERE"}' http://localhost:3000/tournament/events/PASTE_EVENT_ID_HERE/matches/PASTE_MATCH_ID_HERE/participants

### START MATCH (admin o árbitro) — falla si todavía no llegó scheduledStartAt, o si el match no tiene preguntas generadas (reagendalo primero)

curl -X POST -H "Authorization: Bearer PASTE_ACCESS_TOKEN_HERE" http://localhost:3000/tournament/events/PASTE_EVENT_ID_HERE/matches/PASTE_MATCH_ID_HERE/start

### END MATCH (admin o árbitro) — puede cerrarlo antes de lo estimado

curl -X POST -H "Authorization: Bearer PASTE_ACCESS_TOKEN_HERE" http://localhost:3000/tournament/events/PASTE_EVENT_ID_HERE/matches/PASTE_MATCH_ID_HERE/end

### GET CURRENT QUESTION (jugador, solo los 2 del match) — pregunta activa + deadline, sin rúbrica

curl -H "Authorization: Bearer PASTE_ACCESS_TOKEN_HERE" http://localhost:3000/tournament/events/PASTE_EVENT_ID_HERE/matches/PASTE_MATCH_ID_HERE/current-question

### SUBMIT ANSWER (jugador, solo los 2 del match) — responde la pregunta activa

curl -X POST -H "Content-Type: application/json" -H "Authorization: Bearer PASTE_ACCESS_TOKEN_HERE" -d '{"answerText":"1969"}' http://localhost:3000/tournament/events/PASTE_EVENT_ID_HERE/matches/PASTE_MATCH_ID_HERE/answers

### GET ANSWERS (participantes solo tras cerrar el match; admin/árbitro en cualquier momento) — trae ai_score/ai_justification, evaluados por IA (Moonshot) apenas se deja atrás cada pregunta

curl -H "Authorization: Bearer PASTE_ACCESS_TOKEN_HERE" http://localhost:3000/tournament/events/PASTE_EVENT_ID_HERE/matches/PASTE_MATCH_ID_HERE/answers

### Nota: GET .../matches/:matchId trae score_a/score_b/winner_id ya calculados (fórmula 70/30) una vez que el match cierra (closed o walkover) — sin endpoint nuevo, es automático.

### LIST MATCH QUESTIONS (admin o árbitro) — cuestionario completo del match, con rúbrica

curl -H "Authorization: Bearer PASTE_ACCESS_TOKEN_HERE" http://localhost:3000/tournament/events/PASTE_EVENT_ID_HERE/matches/PASTE_MATCH_ID_HERE/questions

### GET MATCH QUESTION BY ID (admin o árbitro)

curl -H "Authorization: Bearer PASTE_ACCESS_TOKEN_HERE" http://localhost:3000/tournament/events/PASTE_EVENT_ID_HERE/matches/PASTE_MATCH_ID_HERE/questions/PASTE_QUESTION_ID_HERE

### UPDATE MATCH QUESTION (admin, partial) — corrección de contenido, solo mientras el match sigue pending

curl -X PATCH -H "Content-Type: application/json" -H "Authorization: Bearer PASTE_ACCESS_TOKEN_HERE" -d '{"rubric":"Respuesta esperada: 1969, aceptar también \"año 69\"."}' http://localhost:3000/tournament/events/PASTE_EVENT_ID_HERE/matches/PASTE_MATCH_ID_HERE/questions/PASTE_QUESTION_ID_HERE

## DISPUTE CHAT

### SEND MESSAGE (jugadores del match, árbitro del evento, o admin) — questionId opcional, para reclamar sobre una pregunta puntual

curl -X POST -H "Content-Type: application/json" -H "Authorization: Bearer PASTE_ACCESS_TOKEN_HERE" -d '{"text":"No estoy de acuerdo con el puntaje de esta pregunta"}' http://localhost:3000/tournament/events/PASTE_EVENT_ID_HERE/matches/PASTE_MATCH_ID_HERE/chat

curl -X POST -H "Content-Type: application/json" -H "Authorization: Bearer PASTE_ACCESS_TOKEN_HERE" -d '{"text":"Mi respuesta mencionaba el punto clave, revisar","questionId":"PASTE_QUESTION_ID_HERE"}' http://localhost:3000/tournament/events/PASTE_EVENT_ID_HERE/matches/PASTE_MATCH_ID_HERE/chat

### LIST MESSAGES (mismos participantes)

curl -H "Authorization: Bearer PASTE_ACCESS_TOKEN_HERE" http://localhost:3000/tournament/events/PASTE_EVENT_ID_HERE/matches/PASTE_MATCH_ID_HERE/chat

## RANKING

### GLOBAL LEADERBOARD (autenticado) — suma de puntos de todos los eventos

curl -H "Authorization: Bearer PASTE_ACCESS_TOKEN_HERE" http://localhost:3000/ranking

### EVENT LEADERBOARD (autenticado)

curl -H "Authorization: Bearer PASTE_ACCESS_TOKEN_HERE" http://localhost:3000/ranking/events/PASTE_EVENT_ID_HERE

## OVERRIDE ADMIN (Fase 10)

### OVERRIDE ANSWER SCORE (admin) — solo en match closed/walkover, recalcula el resultado del match y el ranking

curl -X PATCH -H "Content-Type: application/json" -H "Authorization: Bearer PASTE_ACCESS_TOKEN_HERE" -d '{"score":15,"reason":"La respuesta mencionaba el punto clave que la IA no detectó, según lo discutido en el chat"}' http://localhost:3000/tournament/events/PASTE_EVENT_ID_HERE/matches/PASTE_MATCH_ID_HERE/answers/PASTE_ANSWER_ID_HERE/override

### REOPEN MATCH (admin) — repite el match desde cero (ej. plagio detectado post-match), vuelve a pending, borra respuestas/preguntas/puntaje/ranking de ese match

curl -X POST -H "Content-Type: application/json" -H "Authorization: Bearer PASTE_ACCESS_TOKEN_HERE" -d '{"reason":"Plagio detectado en la respuesta del jugador A, se reabre para sustituirlo"}' http://localhost:3000/tournament/events/PASTE_EVENT_ID_HERE/matches/PASTE_MATCH_ID_HERE/reopen

### Después de reopen: usar PATCH .../participants (ya desbloqueado, vuelve a pending) para sustituir al jugador descalificado, y PATCH .../schedule para reagendar (regenera preguntas nuevas)

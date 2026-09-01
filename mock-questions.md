# Mock trivia questions

Used by `MatchQuestionGenerationService` while the real Moonshot AI call is
commented out (temporary, see the service file). Always the same 10
questions, cycled if a match needs more than 10 — this is a fixed fixture,
not real AI generation. `suggestedMaxScore` values are arbitrary; they get
rescaled to the event's `maxScorePerMatch` regardless.

## 1
Text: What year did the Berlin Wall fall, and what specific announcement triggered its opening that same night?
Rubric: Correct answer must state 1989, and reference the East German government's (accidental) announcement of immediate travel freedom at Günter Schabowski's press conference on 9 November 1989 as the trigger.
Score: 9

## 2
Text: Name the treaty that formally ended World War I between Germany and the Allied Powers, and the year it was signed.
Rubric: Correct answer must name the Treaty of Versailles and the year 1919.
Score: 8

## 3
Text: Which ancient library, associated with the city of Alexandria, is traditionally cited as one of history's greatest losses of accumulated knowledge, and under which ruler's patronage was it founded?
Rubric: Correct answer must name the Library of Alexandria and credit its founding to the Ptolemaic dynasty (Ptolemy I or II Soter/Philadelphus).
Score: 10

## 4
Text: What chemical element has the symbol "Fe", and from what Latin word does that symbol derive?
Rubric: Correct answer must state Iron and the Latin word "ferrum".
Score: 7

## 5
Text: In cellular biology, what is the name of the process by which a cell engulfs external material by folding its membrane around it?
Rubric: Correct answer must name endocytosis (phagocytosis or pinocytosis also acceptable as specific sub-types).
Score: 9

## 6
Text: Who composed the opera cycle "Der Ring des Nibelungen", and roughly how many hours does a full performance of the cycle take?
Rubric: Correct answer must name Richard Wagner and state approximately 15 hours (accept a range of 14-16 hours across four operas).
Score: 11

## 7
Text: What algorithmic complexity class describes problems solvable in polynomial time by a deterministic Turing machine, commonly abbreviated with a single letter?
Rubric: Correct answer must state the complexity class P (as opposed to NP).
Score: 10

## 8
Text: Which mountain range forms a natural border between Europe and Asia, running roughly north-south through Russia?
Rubric: Correct answer must name the Ural Mountains.
Score: 8

## 9
Text: What is the term for a market structure with only two dominant sellers, and name one classic real-world example industry where this structure is often cited?
Rubric: Correct answer must state "duopoly" and give a plausible example (e.g. Airbus/Boeing, Coca-Cola/Pepsi, Visa/Mastercard).
Score: 9

## 10
Text: In Greek mythology, who was tasked with the Twelve Labors as penance, and which king assigned them?
Rubric: Correct answer must name Heracles (Hercules) and King Eurystheus.
Score: 9

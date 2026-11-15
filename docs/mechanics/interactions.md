# Interaction checklist

Every discrete interaction the engine must implement. One line each, with a pointer to the rule that defines it. `core` means [core-rules.md](core-rules.md), `legacy` means [legacy-progression.md](legacy-progression.md), `comp` means [components.md](components.md). The tag after each line is the confidence of the source rule: [R] rulebook, [C] community, [I] inferred.

## Setup

1. Load this month's supply track value into the stockpile. Move the rest of the cubes to the reserve. core C-3 step 1.1 [R]
2. Add lost haven bonuses (+15 each) to the stockpile. legacy L-13.2 [C]
3. Place Turning Points in the Game End area and objectives in the objectives area. core C-3 step 1.3 [R]
4. Reset the Incident marker to 0, the Infection Rate marker to the first "2", and every objective tracking token to 0. core C-3 step 1.5 [R]
5. Place permanent supply centers, towers, and shelters from their stickers. legacy L-12 [C]
6. Read the Legacy deck until PAUSE or STOP, applying each card. core C-11 [R]
7. Players distribute all stockpile cubes onto grid locations, any split. core C-3 step 3 [R]
8. Shuffle the Infection deck. Put Gather and Assemble cards in the Infection discard pile. legacy L-9.1 [C]
9. Setup infection: flip 9 cards, 1 cube or 1 Plague cube per card. core C-3 step 4 [R]
10. Setup infection after September: first 6 cards normal, last 3 place Hollow Men. legacy L-9.4 [C]
11. Setup infection skips forsaken cities: card to the Game End area, flip a replacement. legacy L-3.2 [C]
12. Setup infection applies Infection card improvements. core C-12.4 [R]
13. Group picks Rationed Events up to the rationing level from the reserve. core C-3 step 6.1 [R]
14. Add every Unrationed Event and persistent Player card. core C-3 step 6.1 [R], comp K-6.1 [I]
15. Shuffle and deal by player count: 4, 3, or 2 cards each. Hands face up. core C-3 step 6.2 [R]
16. Count City cards in the Player deck and set the epidemic count. legacy L-4 [C] [I]
17. Split the deck into piles, one Epidemic per pile, smaller piles at the bottom. core C-3 step 7 [R]
18. Each player picks a living character and starts at its home. core C-3 step 8 [R]
19. Use a haven worker when no character is free. core C-9.5 [R]
20. Pick the first player at random. Play goes clockwise. core C-3 step 9 [R]

## Turn steps

21. Exposure check: start of turn in a location with 1 or more Plague cubes gives 1 exposure. core C-4.1 [R]
22. Exposure check: start of turn in an infested city gives 1 exposure. legacy L-3.3 [C]
23. A shelter cancels start-of-turn exposure in its city. legacy L-11 [C]
24. Action step: 4 actions, unlimited free actions, no interrupting. core C-4.2 [R]
25. Draw step: lose if fewer than 2 Player cards remain. core C-7 [R]
26. Draw step: draw 2 together, resolve Epidemics, no replacement draws. core C-7 [R]
27. Hand limit check after Epidemics. Discard or play Events. core C-7.3 [R]
28. Infect step: flip cards equal to the infection rate. core C-8 [R]
29. End turn. Next player to the left. core C-4 [R]

## Player actions (1 action each)

30. Drive or Ferry along any supply line or sea lane. core C-5.1 [R]
31. Sail: discard a City card, move to its city by sea route, port to port. core C-5.2 [R]
32. Charter Boat: discard the current city's card, move to any port on a sea route. core C-5.3 [R]
33. Make Supplies: 1 cube from stockpile to character. core C-5.4 [R]
34. Produce Supplies, Local: fill the current haven or supply center to its population. core C-5.5.1 [R]
35. Produce Supplies, System-Wide: fill all havens and supply centers on the grid, check a box, destroy when full. core C-5.5.1 [R]
36. Produce Supplies with a short stockpile: place what exists in a chosen order. core C-5.5.1 [R]
37. Deliver Supplies: any cubes from character to location. core C-5.6 [R]
38. Share Knowledge give or take, same city, that city's card, both agree. core C-5.7 [R]
39. Build Supply Center: 5 cards of the city's color. core C-5.8 [R]
40. Build Supply Center with every piece placed: move an existing one. core C-5.8 [R]
41. Recon: pay the printed route at a supply center city, open the package. core C-5.9.1 [R]
42. Recon cost symbols: star (any city of the color) and letter (unique cities). core C-5.9.1 [R]
43. Establish Supply Line: 2 cubes, straight line to a revealed city, geometry checks. legacy L-2 [C]
44. Search: hold the current city's card, scratch one box, resolve. legacy L-5 [C]
45. Chart Sea Lane: cubes, port to port, at most 1 red line crossed. legacy L-7 [C]
46. Shuttle Flight between any two havens or supply center cities on the grid. legacy L-8 [C]
47. Build Satellite Tower: 2 cubes. legacy L-10.1 [C]
48. Transmit: at a tower, send 1 City card of the tower's color to any player. legacy L-10.2 [C]
49. Monitor: at a tower, reveal and discard 4 Player cards, scratch a frequency box, resolve it. legacy L-10.3 [C]
50. Broadcast Misinformation: at a tower, move 1 Hollow Man from a city of the tower's color to an adjacent location. legacy L-10.4 [C]
51. Build Shelter: discard 1 City card of the current city's color. legacy L-11 [C]
52. Job and ability actions marked "as an action", including once-per-turn limits. core C-4.3 [C], legacy L-16 [C]

## Free actions

53. Pick Up Supplies from the current location. core C-6.1 [R]
54. Transfer Supplies with a co-located character, with permission to take. core C-6.2 [R]
55. Inoculate: move 1 matching Player or Infection card from its discard pile to Package 6, capacity 30 each. legacy L-6 [C]
56. Inoculate refuses Hollow Men Gather cards. legacy L-6 [C]
57. Free actions are only legal during your own action step. core C-4.2 [R]
58. Ability free actions, such as the Sanitation Officer and Scientist. legacy L-16.1 [C]

## Action legality checks

59. A forsaken city allows only Drive or Ferry out. No other action or free action. legacy L-3.2 [C]
60. A forsaken city cannot be a shuttle endpoint. legacy L-8 [C]
61. The ability activation rule: the whole effect must be possible. core C-4.3 [R]
62. A haven is never a city for city-specific rules (Share Knowledge, City cards, production count). core C-1 [R]
63. Sea movement never crosses land. Only ports. core C-5.2 [R]
64. A Carrier moves only by Drive or Ferry, and discards a card of the destination city's color to enter a city. legacy L-14.3 [C]
65. A Carrier cannot be moved by any other effect. legacy L-14.3 [C]

## Epidemic

66. Increase: advance the rate marker, capped at the end. core C-7.1 [R]
67. Infect (January to August): bottom card, remove all cubes, no Plague cube. core C-7.1 [R]
68. Infect (September on): draw from Package 6, falling back to the bottom card when empty. legacy L-9.5 [C]
69. Epidemic draw of a forsaken city: card to the Game End area, draw a replacement. legacy L-3.2 [C]
70. Epidemic bottom draw of a Gather card: discard, no effect. legacy L-9.1 [C]
71. Intensify: shuffle only the discard pile onto the deck. core C-7.1 [R]
72. Two Epidemics in one draw: resolve fully twice. core C-7.1 [R]

## Infection

73. Infect a city: remove 1 cube, else place a Plague cube, else outbreak. core C-8.1 [R]
74. Placing a Plague cube records an incident. core C-8.2 [R]
75. Outbreak: each adjacent location loses 1 cube or gains 1 Plague cube. Havens included. core C-8.3 [R]
76. Chain reaction outbreaks, queued after the current outbreak. core C-8.3 [R]
77. A location that already outbroke on this card gets no more Plague cubes but can still lose cubes. core C-8.3 [R]
78. A haven at 3 Plague cubes does not chain. core C-8.3 [C]
79. Infection deck exhausted: reshuffle the discard pile, advance the rate, finish this step at the old rate. core C-8.4 [R]
80. Infect step draw of a forsaken city: card to the Game End area, draw a replacement that counts. legacy L-3.2 [C]
81. Gather card: does not count toward the rate. The next city gets 1 Hollow Man instead of an infection. legacy L-9.1 [C]
82. A 4th Hollow Man is not placed. The city loses 1 population instead. legacy L-9.1 [C]
83. No Hollow Man figure left to place: loss. legacy L-9.6 [C]
84. Infection improvement, keep cubes when the city holds 2 or more. core C-12.4 [R]
85. Infection improvement, destroy the card from the discard pile at any time. core C-12.4 [R]
86. Infection improvement, stop further infection draws this turn when drawn, paid by a Player card discard. legacy L-12 [C]
87. Infection improvement Rebirth, conditional on high population. legacy L-12 [C]
88. Topaz: any player discards a City card of the drawn city's color to cancel one cube removal. Not when the city has no cubes. legacy L-14.1 [C]

## Exposure, scars, death

89. Gain exposure: scratch the leftmost box. core C-9.2 [R]
90. Leaving a location with Hollow Men gives 1 exposure, by any movement, on any turn. legacy L-9.2 [C]
91. A shelter cancels exposure from leaving its city. legacy L-11 [C]
92. Scar revealed: choose a scar sticker, place it on an empty slot, a job, or an ability, never on a scar. core C-9.3 [R]
93. A covered job or ability stops working. core C-9.3 [R]
94. Skull revealed: death, place of death written, hand discarded, cubes to the stockpile. core C-9.4 [R]
95. Death mid-turn: lose remaining actions, still draw and infect, bring in a new character at home. core C-9.4 [R]
96. Haven worker exposure: discard hand, lose remaining actions, next turn at any haven. core C-9.5 [R]
97. Self-injection at Pearl: scratch until a scar or a skull. legacy L-14.3 [C]
98. Carrier scar takes 2 slots and cannot be covered. legacy L-14.3 [C]

## Events and companions

99. Events are playable any time except between drawing and resolving a card. core C-7.2 [R]
100. A Rationed Event is discarded after use. An Unrationed Event is destroyed. core C-7.2 [R]
101. Event and companion effect types listed in legacy L-17 and L-5.2. Each needs a handler. [C]
102. Events may move pawns on other players' turns, which can avoid exposure. core C-7.2 [C]

## Win and loss

103. Win at once when the required count is met, including all mandatory objectives. core C-10.1 [R]
104. An impossible objective may be treated as done when it truly cannot be completed. core C-10.1 [C]
105. Objective progress resets between attempts unless the card carries it over. core C-10.1 [C]
106. Loss when the Incident marker reaches the last space. core C-8.2 [R]
107. Loss when the Player deck cannot supply 2 cards. core C-7 [R]
108. Loss when no Hollow Man figure remains to place. legacy L-9.6 [C]
109. Game end is immediate. No further Events or steps. core C-10 [R]

## Objective tracking

110. Build 3 new supply centers this game, any colors. Permanent ones do not count. legacy L-13.1 [C]
111. Connect 2 new cities this game, by any route except Legacy instructions. legacy L-13.1 [C]
112. Recon a new area, or a named region. legacy L-13.1 [C]
113. Perform 2 searches. legacy L-13.1 [C]
114. Access a lost haven. legacy L-13.1 [I]
115. Triangulate Signals: towers in 3 cities of different colors. Reward door, then destroy the card. legacy L-13.1 [C]
116. Defect the Hollow Men: 3 Hollow Men in havens. Carries over. legacy L-13.1 [C]
117. Complete the Plan: 4 recons at Shanghai with unique-card costs. Carries over. legacy L-13.1 [C]
118. Deliver the Sample from Lake Baikal to Johannesburg with a supply center. legacy L-14.3 [C]

## Game End steps

119. Return City and Infection cards from hands and discards to their decks. core C-10.3 [R]
120. Population minus 1 for each location with Plague cubes. core C-12.1 [R]
121. Population minus 1 for each location with Hollow Men (only 1 total with Plague cubes), unless sheltered. legacy L-9.7 [C]
122. Population plus 1 for each city with a supply center. Offsets a loss. Cap 8. core C-12.1 [R]
123. A city reaching 0 becomes forsaken and infested (after the turning point fires). legacy L-3 [C]
124. Read on in the Legacy deck past a PAUSE card. core C-12.2 [R]
125. Shuffle Game End area Infection cards into the Infection deck. core C-12.3 [R]
126. Check Turning Points in number order. Fire or return to the reserve. core C-12.3 [R]
127. Compute production units from cities on the grid, plus 1 for a win. core C-12.4 [R]
128. Apply the rationing change and the calendar move. core C-2 [R]
129. Clear all pieces. Keep stickers. core C-10.3 [R]

## Between-game choices (production units)

130. Buy a character ability for any living created character, empty slot only. core C-12.4 [R]
131. Buy a City card improvement, city on the grid, empty slot. core C-12.4 [R]
132. Buy an Infection card improvement, city on the grid, empty slot. core C-12.4 [R]
133. Raise a non-forsaken location's population by 1 per unit, up to 8. core C-12.4 [R]
134. Restore a forsaken city to 1 for 2 units. core C-12.4 [R]
135. Make a supply center permanent for 3 units (6 stickers). legacy L-12 [C]
136. Make a tower permanent for 3 units. legacy L-12 [C]
137. Make a shelter permanent for 2 units. legacy L-12 [C]
138. Spend free units on abilities when a Legacy card grants them. legacy L-12 [C]
139. Discard unspent units. core C-12.4 [R]
140. Adjust rationing by hand to correct a rule mistake. core C-2.1 [R]

## Permanent changes

141. Write haven names (starting and lost havens). core C-9.1 [R], legacy L-13.2 [C]
142. Create a character with job, portrait, name, age, and home. core C-9.1 [R]
143. Place a map sticker. Revealed cities stay off the grid until connected. legacy L-1.3 [C]
144. Add a city's cards to decks by the timing table. legacy L-1.4 [C]
145. Draw a permanent supply line or sea lane. legacy L-2, L-7 [C]
146. Apply rule stickers to slots A to W. Effective at once. legacy L-0 [C]
147. Add action stickers to the new-actions slots J to Q. legacy L-0 [C]
148. Population value stickers on locations. core C-12.4 [R]
149. Mark a city infested. legacy L-3.3 [C]
150. Scratch exposure boxes, search boxes, Produce Supplies boxes, frequency boxes, and Legacy card boxes. core C-9.2 [R], legacy L-5, L-10.3 [C]
151. Destroy cards: used Unrationed Events, full Produce Supplies cards, Lockdown targets, Scientist targets, objectives on instruction. core C-7.2, C-5.5.1 [R], legacy L-16.1 [C]
152. Store cards in Package 6 across games. legacy L-6 [C]
153. Open a package or a dossier door. Its content enters the reserve. legacy L-0 [C]
154. Perimeter report: if a region is still unopened, open it with a penalty. legacy L-1.5 [C]
155. Lab discovery markers. legacy L-14.1 [C]
156. Record each game on the calendar: month, attempt, rationing, players, result, grid size. core C-2 [R]

## Campaign end

157. After December's step 4, score with the branch for whether the sample was delivered. legacy L-15 [C] [I]
158. Score 50 per early win, 30 per late win, population, 100 for the sample, 25 per lab, minus 5 per forsaken city. legacy L-15 [I]

## Edge-case rulings

159. A city at 3 Plague cubes that still holds a cube only loses the cube. core C-8.1 [C]
160. Setup infection cannot outbreak in practice. core C-3 step 4 [C]
161. An Epidemic never removes cubes held by characters. core C-7.1 [R]
162. Cubes may be delivered to a city with Plague cubes. core C-5.6 [C]
163. A supply center in a Plague city is unaffected during play. core C-13 [C]
164. A haven at population 0 still works and is never forsaken. legacy L-3.2 [C]
165. A Search City card is still a normal City card. legacy L-5 [C]
166. A Gather card played after drawing but before its replacement opens no Event window. core C-7.2 [C, designer ruling]
167. Death during a move is recorded at the location left. core C-9.4 [C]
168. The card-swap Event moves one card each way at the same instant, so no hand limit check happens in between. legacy L-17 [C]
169. Cards for newly connected cities do not enter the current game's Infection deck. legacy L-1.4 [C]
170. Restored forsaken cities stay infested. legacy L-3.3 [C]

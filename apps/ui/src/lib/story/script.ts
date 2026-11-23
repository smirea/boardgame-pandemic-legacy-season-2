import type { Campaign, CityId, Opening, SealKey } from '@repo/game';
import type { SpeakerId } from './cast.ts';

export type SetPieceId =
	| 'epidemicsArrive'
	| 'ghostHaven'
	| 'betrayal'
	| 'frankfurtDestroyed'
	| 'forsakenCities'
	| 'hollowMenArrive'
	| 'wearingOff'
	| 'shanghaiMassacre'
	| 'fadedTruth'
	| 'utopiaHell'
	| 'selfInfect'
	| 'finalReckoning';

export type SfxCue =
	| 'cardFlip'
	| 'crateOpen'
	| 'doorTear'
	| 'scratch'
	| 'epidemicDraw'
	| 'inoculationSafe'
	| 'wearingOffSnap'
	| 'cityDestroyed'
	| 'hollowDrop'
	| 'radioDecode'
	| 'utopiaCorrupt'
	| 'vialClink'
	| 'exposureScar'
	| 'victory'
	| 'defeat';

export type StoryBeat = {
	id: string;
	speaker: SpeakerId;
	/** Optional listening character shown in atmospheric silhouette on the opposite flank. */
	listener?: SpeakerId;
	text: string;
	style?: 'narrator' | 'speech' | 'thought' | 'radio';
	cue?: SfxCue;
	setPiece?: SetPieceId;
	/** When true, this beat reads verbatim text from the printed game component. */
	verbatim?: boolean;
};

export type StoryScene = {
	id: string;
	act: string;
	title: string;
	subtitle?: string;
	setPiece?: SetPieceId;
	beats: StoryBeat[];
};

const beat = (
	id: string,
	speaker: SpeakerId,
	text: string,
	opts: Omit<StoryBeat, 'id' | 'speaker' | 'text'> = {},
): StoryBeat => ({ id, speaker, text, ...opts });

/**
 * Complete campaign narrative registry keyed by scene id:
 * - `prelude`: Rulebook Page 3 opening ("The World Almost Ended 71 Years Ago")
 * - Legacy card codes (`00-01`, `01-01`, ..., `12-12`, plus `02-01:raid` for forced perimeter raids)
 * - Packages (`pkg:1`..`pkg:8`)
 * - Dossier doors (`door:11`, `door:12`, `door:17`, `door:18`, `door:19`, `door:20`, `door:21`, `door:22`, etc.)
 * - Searches (`search:<city>:<scope>`)
 */
export const STORY_SCENES: Record<string, StoryScene> = {
	prelude: {
		id: 'prelude',
		act: 'Act 0 · Year 71 of the Fall',
		title: 'The World Almost Ended 71 Years Ago',
		subtitle: 'Instructions for a Better Life on the Havens',
		beats: [
			beat(
				'prelude_01',
				'chronicler',
				"The plague came out of nowhere and ravaged the world. Fever, cough, sores, and death—once infected, most died within a week. Nothing could stop it. The world did its best. It wasn't good enough.",
				{ verbatim: true },
			),
			beat(
				'prelude_02',
				'chronicler',
				'The last fragments of our people have desperately kept the world from collapsing completely. For three generations we have lived on the seas, on floating stations they called "havens." Far from the plague, we are able to provide supplies to the mainland—antibiotics, food, medicine, and tools—to keep them, and us, from succumbing completely.',
				{ verbatim: true },
			),
			beat(
				'prelude_03',
				'mara',
				"Things have been tough the past few years. Cities far away from the havens have fallen off our grid. We don't know what's happened to them. We have only a few cities left on our grid. We are failing. The supplies aren't keeping the plague away like they used to. What's more, they're running out.",
				{ listener: 'tomas', verbatim: true },
			),
			beat(
				'prelude_04',
				'kai',
				'Our leadership tried to hide this fact from us, but we all knew. Last week, the leaders and thinkers of the havens gathered for their yearly summit. They did not return—and our main security team was with them. Without our soldiers, the Hollow Men will tear down what we build and steal what we offer.',
				{ listener: 'mara', verbatim: true },
			),
			beat(
				'prelude_05',
				'mara',
				'After hours of debate, all eyes turned to a select few to lead. Us. Not because we are able to lead, but because we are willing. We are starting this journal to record our attempts to keep the world from ending. If we fail, we hope someone finds these notes to know that we may not have succeeded—but that we tried.',
				{ listener: 'kai', verbatim: true },
			),
		],
	},

	'00-01': {
		id: '00-01',
		act: 'Prologue',
		title: 'First Supply Runs',
		subtitle: 'Journal Entry · 00-01',
		beats: [
			beat(
				'00_01_01',
				'mara',
				"We've barely got our heads around this mess, and yet we now find ourselves in charge. We're covering ourselves up and heading out on supply runs to see the front lines and gauge how bad things are.",
				{ listener: 'kai', verbatim: true, cue: 'cardFlip' },
			),
			beat(
				'00_01_02',
				'mara',
				"Things are going to get real very soon. The Hollow Men will tear down our supply centers almost as soon as we build them, but we've got to start restoring our presence on the mainland.",
				{ listener: 'kai', verbatim: true },
			),
		],
	},

	'01-01': {
		id: '01-01',
		act: 'January · Year 71',
		title: 'Opening the Legacy Deck',
		subtitle: 'Journal Entry · 01-01',
		beats: [
			beat(
				'01_01_01',
				'chronicler',
				'January. Seventy-one years after the Fall. The seal breaks on the first journal entry.',
				{ cue: 'cardFlip' },
			),
			beat(
				'01_01_02',
				'mara',
				"Priorities: Find our leaders. Find more supplies. Attached a document we found dated last year. It's grim. Our supplies won't last the year. Perhaps North America will give us clues; it's where the plague started.",
				{ listener: 'tomas', verbatim: true },
			),
			beat(
				'01_01_03',
				'mara',
				"The Hollow Men are raiding surviving coastal cities and it's only a matter of time before they move inland. We need to recon before they do. Hope the people we meet know that we are there to help. Old prejudices last long.",
				{ listener: 'tomas', verbatim: true },
			),
		],
	},

	'01-02': {
		id: '01-02',
		act: 'January · From the Archives',
		title: 'October 15, Year 70',
		subtitle: 'Archive Dispatch · 01-02',
		beats: [
			beat(
				'01_02_01',
				'archive',
				'October 15, Year 70. Degradation of supplies and routes has reached critical level. We are no longer effective. Supply lines to the interior have been abandoned. Cities will fall within a year and, when they do, we will fall.',
				{ listener: 'tomas', style: 'radio', verbatim: true },
			),
			beat(
				'01_02_02',
				'archive',
				"Next year's stockpile projections are fatalistic. Haven leadership has voted to initiate the protocol we hoped would never come.",
				{ listener: 'tomas', style: 'radio', verbatim: true },
			),
			beat(
				'01_02_03',
				'tomas',
				'"The protocol we hoped would never come." They kept this locked away for months... and never told us what it meant.',
				{ listener: 'archive', style: 'thought' },
			),
		],
	},

	'01-06': {
		id: '01-06',
		act: 'January · Turning Point #1',
		title: 'Forsaken Cities',
		subtitle: 'Turning Point · 01-06',
		beats: [
			beat(
				'01_06_01',
				'chronicler',
				'Turning Point One: Forsaken Cities. Should any city on the grid fall to zero population, its lights go out for good—and Doors A and 12 will open.',
				{ cue: 'cardFlip' },
			),
		],
	},

	'02-01': {
		id: '02-01',
		act: 'February · Perimeter Report',
		title: 'North America Raided',
		subtitle: 'Perimeter Report · 02-01',
		beats: [
			beat(
				'02_01_01',
				'kai',
				'Our scouts report that the Hollow Men have raided North America. We quickly mobilized... but too late. Package 1 is breached—and the Decontamination Kit inside is destroyed.',
				{ listener: 'mara', verbatim: true, cue: 'scratch' },
			),
		],
	},

	'02-02': {
		id: '02-02',
		act: 'February · Year 71',
		title: 'The Raids Expand',
		subtitle: 'Journal & Archive · 02-02',
		beats: [
			beat(
				'02_02_01',
				'mara',
				'Hollow Men are expanding their raids now that our leaders and soldiers have disappeared. Our supply routes, already abandoned, are unsafe. They are working their way into South America, likely looking for one of the labs working on a cure. We need to find a way to fortify our supply centers so they can resist their attacks.',
				{ listener: 'tomas', verbatim: true },
			),
			beat(
				'02_02_02',
				'tomas',
				"From the Archives—April 24, Year 40. Reports from the frontier havens. Hollow Men have breached them with help of local population who still distrust us. Sending security patrols, but it might be too late. We're going to start having to dilute supplies or abandon supply routes.",
				{ listener: 'mara', verbatim: true },
			),
		],
	},

	'02-06': {
		id: '02-06',
		act: 'February · Turning Point #2',
		title: 'Give Us the Tools',
		subtitle: 'Turning Point · 02-06',
		beats: [
			beat(
				'02_06_01',
				'chronicler',
				'Turning Point Two: Give Us the Tools and We Will Finish the Job. Should four straight months end in defeat, emergency supply caches will unlock.',
			),
		],
	},

	'03-01': {
		id: '03-01',
		act: 'March · Perimeter Report',
		title: 'Race to South America',
		subtitle: 'Perimeter Report · 03-01',
		beats: [
			beat(
				'03_01_01',
				'kai',
				"It's critical that we Recon South America soon—before the Hollow Men sabotage anything important.",
				{ listener: 'mara', verbatim: true, cue: 'scratch' },
			),
		],
	},

	'03-02': {
		id: '03-02',
		act: 'March · Year 71',
		title: 'Fifty-Year Limit',
		subtitle: 'Journal & Archive · 03-02',
		beats: [
			beat(
				'03_02_01',
				'mara',
				"Havens have been in trouble for a while. Old records show that the four main labs were never meant to go beyond fifty years. Nor were the supplies. Our leaders have been putting on a good show for a long time now. They knew the end was near. Now they are gone and it's a race between us and the Hollow Men.",
				{ listener: 'tomas', verbatim: true },
			),
			beat(
				'03_02_02',
				'tomas',
				'Year 57 Summary. PEARL was on the verge of a cure when it went silent. OPAL, JADE, and TOPAZ are set up to support PEARL—they are not equipped to find a cure on their own. Transporting a potential cure from PEARL to JADE was always going to be a frantic dash. We must keep the routes between them viable.',
				{ listener: 'mara', verbatim: true },
			),
		],
	},

	'03-06': {
		id: '03-06',
		act: 'March Game End · Major Escalation',
		title: 'The Plague Surges',
		subtitle: 'Doors K, 24, 47, E · Epidemics Enter the Deck',
		setPiece: 'epidemicsArrive',
		beats: [
			beat(
				'03_06_01',
				'chronicler',
				'The first wave of spring breaks across the Atlantic. Five Epidemic cards slide into the Player deck. From this moment on, the plague accelerates.',
				{ cue: 'epidemicDraw', setPiece: 'epidemicsArrive' },
			),
			beat(
				'03_06_02',
				'tomas',
				'Infection rates are spiking across every port. Chart new sea lanes while you still have cubes to spend—and watch your crews closely. New scars are surfacing.',
				{ listener: 'mara' },
			),
		],
	},

	'04-01': {
		id: '04-01',
		act: 'April · Perimeter Report',
		title: 'South America Raided',
		subtitle: 'Perimeter Report · 04-01',
		beats: [
			beat(
				'04_01_01',
				'kai',
				'Our scouts report that the Hollow Men have raided South America. We quickly mobilized... but too late. Package 5 is open, and Strategic Reserves is lost.',
				{ listener: 'mara', verbatim: true, cue: 'scratch' },
			),
		],
	},

	'04-02': {
		id: '04-02',
		act: 'April · Year 71',
		title: 'The Torn Coordinates',
		subtitle: 'Journal & Archive · 04-02',
		beats: [
			beat(
				'04_02_01',
				'mara',
				"This year is already taking its toll. People and resources are getting stretched thin. Gearing up to be out in the world is mentally difficult as we're outsiders there. One bright spot are the laboratories. Although they lost their lead lab, the three labs in the Southern Hemisphere have kept working through the generations. We need to find out if they've made any progress.",
				{ listener: 'tomas', verbatim: true },
			),
			beat(
				'04_02_02',
				'tomas',
				'Year 42. Pacific Haven not reporting. Hoping Hollow Men did not steal everything. Sending scouts to Lima to check. Also sending patrols to Indian Haven—silent since the fallout in the Indian Ocean. Presumed lost. Look at the torn slip pinned underneath: coordinates for JADE, OPAL, TOPAZ... and half a line for PEARL.',
				{ listener: 'mara', verbatim: true },
			),
		],
	},

	'05-01': {
		id: '05-01',
		act: 'May · Perimeter Report',
		title: 'Records of a Fallen Haven',
		subtitle: 'Perimeter Report · 05-01',
		beats: [
			beat(
				'05_01_01',
				'tomas',
				'We have found records from twenty-five years ago showing the location of a now-fallen haven. It contained the equipment to generate supplies and was about to field test inoculating against the plague! We now know where it is. It is vital we access it.',
				{ listener: 'mara', verbatim: true, cue: 'scratch' },
			),
		],
	},

	'05-02': {
		id: '05-02',
		act: 'May · The Betrayal',
		title: 'Why We Are Still Here',
		subtitle: 'Journal & Archive · November 5, Year 70',
		setPiece: 'betrayal',
		beats: [
			beat(
				'05_02_01',
				'mara',
				"Hollow Men have left the Americas alone and seem to be moving—retreating?—into Europe and Africa. They stop at nothing. Wherever they go, the plague follows. After seventy years, old prejudices still exist. Also... we've learned where our leaders went. And why we're still here.",
				{ listener: 'tomas', verbatim: true },
			),
			beat(
				'05_02_02',
				'archive',
				"November 5, Year 70. Initiating the protocol during our annual leadership summit. It's a long journey to Utopia. We are the best and brightest minds of the havens and feel confident that Utopia will take us in, despite our differences. We have knowledge, skills, and experience. Those we leave behind would not gain access to Utopia. The list is made. Not an easy task, but necessary. Godspeed us on our journey.",
				{ listener: 'mara', style: 'radio', verbatim: true, setPiece: 'betrayal' },
			),
			beat(
				'05_02_03',
				'kai',
				'They didn’t vanish. They made a list—took our soldiers, took our best gear, and left the rest of us out here on the water to rot.',
				{ listener: 'archive' },
			),
		],
	},

	'06-01': {
		id: '06-01',
		act: 'June · Perimeter Report',
		title: 'Reign of Terror in Europe',
		subtitle: 'Perimeter Report · 06-01 & Door 21',
		setPiece: 'frankfurtDestroyed',
		beats: [
			beat(
				'06_01_01',
				'kai',
				'Our scouts report that the Hollow Men have raided Europe. We quickly mobilized... but too late. Relocation is gone—and open Door 21.',
				{ listener: 'mara', verbatim: true, cue: 'scratch' },
			),
		],
	},

	'06-02': {
		id: '06-02',
		act: 'June · Year 71',
		title: 'Utopia & Violent Souls',
		subtitle: 'Journal & Archive · 06-02',
		beats: [
			beat(
				'06_02_01',
				'mara',
				"Utopia. Can we reach them? Our leaders went there. It's the last true piece of civilization left—secure enough to resist both the plague and the Hollow Men. Perhaps they have a cure? We don't know exactly where Utopia is. Somewhere in the far east. Some think they would help us. Some think they would kill us on sight.",
				{ listener: 'kai', verbatim: true },
			),
			beat(
				'06_02_02',
				'archive',
				'May 23, Year 14 after the Fall. A new problem—an organized militia has started attacking our supply routes. They seem to be normal humans, but somehow dead inside. Military Director Yona has dubbed them the "Hollow Men" because of their "violent souls."',
				{ listener: 'mara', style: 'radio', verbatim: true },
			),
		],
	},

	'06-03': {
		id: '06-03',
		act: 'June Game End',
		title: 'New Volunteers Step Forward',
		subtitle: 'Doors 44 & 49 · Sanitation Officer & Captain',
		beats: [
			beat(
				'06_03_01',
				'mara',
				'New volunteers from the havens have decided to join us. A Sanitation Officer who keeps our closed decks alive, and a veteran Captain who knows every sea lane on the chart.',
				{ listener: 'kai', verbatim: true, cue: 'doorTear' },
			),
		],
	},

	'07-01': {
		id: '07-01',
		act: 'July · Perimeter Report',
		title: 'Africa Raided',
		subtitle: 'Perimeter Report · 07-01',
		beats: [
			beat(
				'07_01_01',
				'kai',
				'Our scouts report that the Hollow Men have raided Africa. We quickly mobilized... but too late. Package 7 is breached, and the TOPAZ Experimental Vaccine inside is destroyed.',
				{ listener: 'mara', verbatim: true, cue: 'scratch' },
			),
		],
	},

	'07-02': {
		id: '07-02',
		act: 'July · Year 71',
		title: 'Signals in the Static',
		subtitle: 'Journal & Archive · 07-02',
		beats: [
			beat(
				'07_02_01',
				'kai',
				"Satellite towers have started picking up faint broadcast signals. Need to know who is transmitting. We think it's Hollow Men, but there's someone else. Could the Hollow Men be taking orders? Is someone ordering them to spread the plague?",
				{ listener: 'mara', verbatim: true, cue: 'radioDecode' },
			),
			beat(
				'07_02_02',
				'mara',
				"The grid is growing and can't handle Hollow Men spreading the plague. We're prepared to forsake some cities if need be. Would that make us the monsters the world thinks we are?",
				{ listener: 'kai', style: 'thought', verbatim: true },
			),
			beat(
				'07_02_03',
				'tomas',
				'From the Archives—July, Year 38. Strange to see adults on the havens who never knew the world before. I dream to live on land again. I sometimes dream of fleeing for Utopia. I miss land and dirt. I hear they are close to a cure. Would they share it with our people?',
				{ listener: 'mara', verbatim: true },
			),
		],
	},

	'08-01': {
		id: '08-01',
		act: 'August · Perimeter Report',
		title: 'Middle East Raided',
		subtitle: 'Perimeter Report · 08-01',
		beats: [
			beat(
				'08_01_01',
				'kai',
				'Our scouts report that the Hollow Men have raided the Middle East. We quickly mobilized... but too late. Package 2 is open, and Renewal is destroyed.',
				{ listener: 'mara', verbatim: true, cue: 'scratch' },
			),
		],
	},

	'08-02': {
		id: '08-02',
		act: 'August · Year 71',
		title: 'Listening to the Frequencies',
		subtitle: 'Journal & Archive · 08-02',
		beats: [
			beat(
				'08_02_01',
				'kai',
				'Have finally fully accessed the satellite towers. Starting to monitor different frequencies. Whoever is broadcasting uses multiple channels. Accessing the towers has given us a sense of purpose. We feel invigorated! Spend up to three production units on character abilities right now.',
				{ listener: 'tomas', verbatim: true, cue: 'radioDecode' },
			),
			beat(
				'08_02_02',
				'tomas',
				'December 19, Year 48. PEARL has stopped reporting. Their last broadcast said they had found what they needed! The sediment cores contained bacteria samples in which they had identified the bacteriophage. We had it! We had a means to a cure. Now they are gone. Sending a team to investigate. They are covered properly to avoid attention.',
				{ listener: 'kai', verbatim: true },
			),
		],
	},

	'08-04': {
		id: '08-04',
		act: 'August · Frequency Scanner',
		title: "It's Time to Start Listening",
		subtitle: 'Frequency Scanner · 08-04',
		beats: [
			beat(
				'08_04_01',
				'kai',
				"It's time to start listening. The Frequency Scanner is live—use Monitor at any satellite tower to sweep the bands and crack their codes.",
				{ listener: 'mara', verbatim: true, cue: 'radioDecode' },
			),
		],
	},

	'09-01': {
		id: '09-01',
		act: 'September · Perimeter Report',
		title: 'Another Lost Haven Sighted',
		subtitle: 'Perimeter Report · 09-01',
		beats: [
			beat(
				'09_01_01',
				'kai',
				"We've finally located another lost haven. We still need to get to it, but now, at least, we know where to go. Open Door 65.",
				{ listener: 'mara', verbatim: true, cue: 'scratch' },
			),
		],
	},

	'09-02': {
		id: '09-02',
		act: 'September · Year 71',
		title: 'Tendrils of Despair',
		subtitle: 'Journal & Archive · 09-02',
		beats: [
			beat(
				'09_02_01',
				'mara',
				"PEARL and its possible cure is all we have left. We need this. The year is drawing to a close and this is our last chance. We need to find it. We need to get it. We need to start making a cure. What are Utopia's motives? Are they holding PEARL hostage?",
				{ listener: 'tomas', verbatim: true },
			),
			beat(
				'09_02_02',
				'tomas',
				'April 15, Year 44. Two of our havens are gone. Without their supplies, our ability to continue has been severely compromised. I feel the first real tendrils of despair entering my heart. Is someone so depraved that they would let us all die? If we were gone, then what?',
				{ listener: 'mara', verbatim: true },
			),
		],
	},

	'09-03': {
		id: '09-03',
		act: 'September · Critical Crisis',
		title: "2-It's Wearing Off",
		subtitle: 'Doors R, 55, D, Y, U · Inoculation Fails',
		setPiece: 'wearingOff',
		beats: [
			beat(
				'09_03_01',
				'chronicler',
				'September. Every city you sealed away inside Package 6, every infection you thought was behind you—the inoculation is failing.',
				{ cue: 'wearingOffSnap' },
			),
			beat(
				'09_03_02',
				'tomas',
				'No... the stored samples in Package 6 are breaking down! Pull every Epidemic card from the deck—Step 2 is no longer safe! They are coming back into play!',
				{ listener: 'mara', setPiece: 'wearingOff' },
			),
			beat(
				'09_03_03',
				'mara',
				"Two: It's wearing off. Draw a random Infection card from Package 6, strip every supply cube in that city, and throw it back into the discard pile. And worse—Hollow Men are now hitting our starting cities during setup. If we run out of figures, we lose.",
				{ listener: 'tomas', verbatim: true },
			),
		],
	},

	'10-01': {
		id: '10-01',
		act: 'October · Perimeter Report',
		title: 'Desperate Strike Into Asia',
		subtitle: 'Perimeter Report · 10-01',
		beats: [
			beat(
				'10_01_01',
				'mara',
				'We led a desperate strike force to find a path to Asia. Found one at great cost. Open Package 3, destroy Biodome Prototype, and mark a scar on one of our crew.',
				{ listener: 'kai', verbatim: true, cue: 'exposureScar' },
			),
		],
	},

	'10-02': {
		id: '10-02',
		act: 'October · Year 71',
		title: 'Turning Their Signal Against Them',
		subtitle: 'Journal & Archive · October, Year 1',
		beats: [
			beat(
				'10_02_01',
				'mara',
				'So far from our homes. So much chaos. So much hatred toward us. Even still... not sure how much longer we can do this. Not sure humanity is worth it. Still, we have found a way to use the satellite towers against the Hollow Men. If we lure them onto our havens, we think we can persuade some of them to join our cause.',
				{ listener: 'tomas', verbatim: true },
			),
			beat(
				'10_02_02',
				'tomas',
				'From the Archives—October, Year 1. Five months on these "havens." I understand why, but I still miss home. I hope my children will soon return to the home we left. I left a note there for them to read when we return. For now, they cry every night, but soon all will feel normal... as normal as it can be.',
				{ listener: 'mara', verbatim: true },
			),
		],
	},

	'10-03': {
		id: '10-03',
		act: 'October · New Priorities',
		title: 'Broadcast Misinformation',
		subtitle: 'Doors P & 37 · Lure the Hollow Men',
		beats: [
			beat(
				'10_03_01',
				'kai',
				'We hijacked their channel. Broadcast Misinformation is online—pull Hollow Men onto three different havens and we can break their conditioning.',
				{ listener: 'mara', cue: 'radioDecode' },
			),
		],
	},

	'11-01': {
		id: '11-01',
		act: 'November · Intelligence Report',
		title: 'Turned at Great Cost',
		subtitle: 'Intelligence Report · 11-01',
		beats: [
			beat(
				'11_01_01',
				'mara',
				"We've gotten them to turn, but at great cost. Open Door 17—and two of our characters take scars.",
				{ listener: 'vey', verbatim: true, cue: 'exposureScar' },
			),
		],
	},

	'11-02': {
		id: '11-02',
		act: 'November · Year 71',
		title: 'Our Prison Became Last Hope',
		subtitle: 'Journal & Archive · June 18, Year 10',
		beats: [
			beat(
				'11_02_01',
				'mara',
				"This is our month. Every November, Utopia releases new Hollow Men into the world. For two days, they are distracted. Our recon into the city needs to happen this month or we'll miss our opportunity. We don't know what we'll find in there or what we'll find at PEARL. We need to be prepared for anything.",
				{ listener: 'tomas', verbatim: true },
			),
			beat(
				'11_02_02',
				'tomas',
				"June 18, Year 10. Ten years upon the seas. Five years toward a cure. No one knew the long-term effects of COdA. Our minds are ours again, but our skin is forever faded. Even our children are born faded. These havens proved to be a godsend when the plague struck. Our prison became humanity's last hope.",
				{ listener: 'mara', verbatim: true },
			),
		],
	},

	'11-05': {
		id: '11-05',
		act: 'November · The Plan',
		title: 'The Plan Is Finalized',
		subtitle: 'The Plan · 11-05',
		beats: [
			beat(
				'11_05_01',
				'kai',
				"The Hollow Men gave us inside information to help us access Utopia. We've finalized our plan. Four steps in Shanghai—hidden entrance, access key, distraction, containment. Check all four boxes and we crack Utopia wide open.",
				{ listener: 'vey', verbatim: true, cue: 'cardFlip' },
			),
		],
	},

	'12-01': {
		id: '12-01',
		act: 'December · Perimeter Report',
		title: 'The Hollow Men Rise Up',
		subtitle: 'Perimeter Report · 12-01',
		beats: [
			beat(
				'12_01_01',
				'vey',
				'The new Hollow Men turned on Utopia, rising up to aid our cause! Open Package 8—the gates are breached, though Riot Control is lost in the fighting.',
				{ listener: 'mara', verbatim: true, cue: 'scratch' },
			),
		],
	},

	'12-02': {
		id: '12-02',
		act: 'December · The Final Month',
		title: 'Not With a Bang, But With a Whimper',
		subtitle: 'Journal & Archive · December, Year 70',
		beats: [
			beat(
				'12_02_01',
				'mara',
				"Our supplies are almost gone. We have come so close. We've reconnected the world. Now we hope to cure it. We must reach Lake Baikal, find the PEARL Lab, get whatever cure they have created, and bring it to Johannesburg. We won't have this opportunity again. If we don't do it this month, then all is lost.",
				{ listener: 'amaya', verbatim: true },
			),
			beat(
				'12_02_02',
				'archive',
				'December, Year 70. Final note before the exodus to Utopia. The havens failed. The labs did not do their jobs. We did not do ours. We had such hopes that the Faded could hold the world together. But the havens end "not with a bang, but with a whimper." I feel pity for those we leave behind. To Utopia we march. To salvation.',
				{ listener: 'mara', style: 'radio', verbatim: true },
			),
		],
	},

	'12-05': {
		id: '12-05',
		act: 'Final Reckoning',
		title: 'At Last',
		subtitle: 'The Fate of Humanity · 12-05',
		setPiece: 'finalReckoning',
		beats: [
			beat(
				'12_05_01',
				'chronicler',
				"It's over. Seventy-one years on the sea, twelve desperate months across a broken world. The fate of humanity was in your hands.",
				{ verbatim: true, setPiece: 'finalReckoning' },
			),
		],
	},

	'12-06': {
		id: '12-06',
		act: 'Final Reckoning · Sample Not Delivered',
		title: 'Please Remember Us',
		subtitle: 'Ending · 12-06',
		setPiece: 'finalReckoning',
		beats: [
			beat(
				'12_06_01',
				'mara',
				'We have failed to save our people. Without the supplies and the sample, the Faded living in the havens will die. We did not choose to have this disease. We shall soon be gone. Only the non-Faded humans of Utopia will be left to repopulate the earth.',
				{ listener: 'tomas', verbatim: true, cue: 'defeat', setPiece: 'finalReckoning' },
			),
			beat(
				'12_06_02',
				'tomas',
				'If you are reading this, we want you to know that we, the Faded, were not monsters; we were people. Our time was brief and we inadvertently brought much pain to the world. Please remember us.',
				{ listener: 'mara', verbatim: true },
			),
		],
	},

	'12-07': {
		id: '12-07',
		act: 'Final Reckoning · Sample Delivered',
		title: 'We Are Here to Stay',
		subtitle: 'Ending · 12-07',
		setPiece: 'finalReckoning',
		beats: [
			beat(
				'12_07_01',
				'amaya',
				"The sample has been extracted from the carrier; we will always remember their sacrifice. Production will start within days. Utopia's plan of exterminating us is over.",
				{ listener: 'mara', verbatim: true, cue: 'victory', setPiece: 'finalReckoning' },
			),
			beat(
				'12_07_02',
				'mara',
				'The world belongs to Faded and non-Faded now. They waited for us to die, but we survived. We are here to stay.',
				{ listener: 'amaya', verbatim: true },
			),
		],
	},

	'pkg:1': {
		id: 'pkg:1',
		act: 'Package 1 · North America',
		title: 'Where It All Started',
		subtitle: 'Recon Report · P1-01',
		beats: [
			beat(
				'pkg1_01',
				'kai',
				'It started here, in North America. After COdA, there was chaos. Then the plague hit. The world could not handle back-to-back pandemics. We need to reconnect our supply lines, watch for any sign of other havens, and find more supplies. Perhaps our leaders went here? Too many questions.',
				{ listener: 'mara', verbatim: true, cue: 'crateOpen' },
			),
		],
	},

	'pkg:2': {
		id: 'pkg:2',
		act: 'Package 2 · Middle East & South Asia',
		title: 'The Hollow Men Arrive',
		subtitle: 'Recon Report · P2-01',
		setPiece: 'hollowMenArrive',
		beats: [
			beat(
				'pkg2_01',
				'chronicler',
				'The fog parts over the Middle East—and for the first time, the shadows step onto the board.',
				{ cue: 'hollowDrop', setPiece: 'hollowMenArrive' },
			),
			beat(
				'pkg2_02',
				'kai',
				"This region is sinister. The locals swear that the Hollow Men who roam the area transport rats and vermin and release them into cities. There are satellite towers here, picking up faint transmissions from... someone. By August we think we'll be able to fine-tune our equipment and start listening in.",
				{ listener: 'mara', verbatim: true },
			),
		],
	},

	'pkg:3': {
		id: 'pkg:3',
		act: 'Package 3 · East Asia',
		title: 'The Walled City of Utopia',
		subtitle: 'Recon Report · P3-01',
		beats: [
			beat(
				'pkg3_01',
				'mara',
				"We have now Reconned East Asia. We didn't expect this. We thought maybe the world still existed here. Instead we found the people of the region huddled in shelters, living in fear of the walled-off Utopia. The Hollow Men come from there. Every November a new wave is released to terrorize the planet.",
				{ listener: 'kai', verbatim: true, cue: 'crateOpen' },
			),
			beat(
				'pkg3_02',
				'kai',
				"We've started developing a plan to get into Utopia in November, but we need inside information. We need to get some Hollow Men to defect to our side.",
				{ listener: 'mara', verbatim: true },
			),
		],
	},

	'pkg:4': {
		id: 'pkg:4',
		act: 'Package 4 · Europe',
		title: 'Wings Over the Old Continent',
		subtitle: 'Recon Report · P4-01',
		beats: [
			beat(
				'pkg4_01',
				'kai',
				'We found Europe struggling as much as the rest of the world, but, surprisingly, there are some old military bases with functioning aircraft. We can adjust our supply centers to include a landing strip, and the havens already have old runways we could put back in use.',
				{ listener: 'mara', verbatim: true, cue: 'crateOpen' },
			),
		],
	},

	'pkg:5': {
		id: 'pkg:5',
		act: 'Package 5 · South America',
		title: 'Rumors of the Southern Labs',
		subtitle: 'Recon Report · P5-01',
		beats: [
			beat(
				'pkg5_01',
				'tomas',
				"Labs. There were laboratories looking for a cure. Things didn't seem to be going well; our leaders were tight-lipped on the subject. Common rumor on the havens is that they are all far to the south. Perhaps one is here? Is it still working? Have they made any advancements?",
				{ listener: 'mara', verbatim: true, cue: 'crateOpen' },
			),
		],
	},

	'pkg:6': {
		id: 'pkg:6',
		act: 'Package 6 · Eastern Pacific Lost Haven',
		title: 'The Ghost Haven & Inoculation',
		subtitle: 'Recon Report · P6-01',
		setPiece: 'ghostHaven',
		beats: [
			beat(
				'pkg6_01',
				'tomas',
				'Eerie. Just like our homes. Same design... same layout. Is this our future—empty cities rusting into the ocean?',
				{ listener: 'mara', verbatim: true, cue: 'inoculationSafe', setPiece: 'ghostHaven' },
			),
			beat(
				'pkg6_02',
				'tomas',
				'Searching for a few days revealed some breakthroughs—portable lab technology enabling supplies to be generated in the field, and experimental medicine to inoculate populations. These cities will remain inoculated for months—buying us some time—before it slowly wears off. Plus fifteen supply cubes in the hold.',
				{ listener: 'mara', verbatim: true },
			),
		],
	},

	'pkg:7': {
		id: 'pkg:7',
		act: 'Package 7 · Africa',
		title: 'Towers Across the Brink',
		subtitle: 'Recon Report · P7-01',
		beats: [
			beat(
				'pkg7_01',
				'kai',
				'There is infestation here; vermin carrying the plague run through the cities. The abandonment of supply lines by our haven leadership has driven much of the world to the brink. Old satellite towers dot the landscape—we can use them to broadcast information across the grid.',
				{ listener: 'tomas', verbatim: true, cue: 'crateOpen' },
			),
		],
	},

	'pkg:8': {
		id: 'pkg:8',
		act: 'Package 8 · Inside Utopia',
		title: 'Hell on Earth',
		subtitle: 'Recon Report · P8-01',
		setPiece: 'utopiaHell',
		beats: [
			beat(
				'pkg8_01',
				'chronicler',
				'The walls of Utopia finally part. Behind the gleaming myth of salvation waits the ugliest truth of the last seventy years.',
				{ cue: 'utopiaCorrupt', setPiece: 'utopiaHell' },
			),
			beat(
				'pkg8_02',
				'mara',
				"We have accessed Utopia. But this is no utopia... this is hell on Earth. Utopia's mission? Kill the Faded and the people we are helping, and then repopulate the world with uninfected humans. Every year they expel males to keep their population down. These Hollow Men are tasked to destroy us in order to be allowed home.",
				{ listener: 'vey', verbatim: true },
			),
			beat(
				'pkg8_03',
				'vey',
				"What's more, Utopia has had the PEARL laboratory under armed guard for thirty years. Utopia has been holding the cure from the world. They were just waiting for us to die.",
				{ listener: 'mara', verbatim: true },
			),
		],
	},

	'door:A': {
		id: 'door:A',
		act: 'Turning Point #1 Triggered',
		title: 'A City Goes Dark',
		subtitle: 'Doors A & 12 · Forsaken Cities',
		setPiece: 'forsakenCities',
		beats: [
			beat(
				'doorA_01',
				'chronicler',
				'Population zero. The last lamps on the shoreline go out. The city is forsaken—and the plague claims its empty streets.',
				{ cue: 'doorTear', setPiece: 'forsakenCities' },
			),
			beat(
				'doorA_02',
				'mara',
				'Mark it forsaken and infested. Nothing works there now except Drive or Ferry—and bringing it back will cost double at game end.',
				{ listener: 'tomas' },
			),
		],
	},

	'door:11': {
		id: 'door:11',
		act: 'Indian Ocean Lost Haven',
		title: 'Renewed Hope',
		subtitle: 'Door 11 · Field Report',
		beats: [
			beat(
				'door11_01',
				'mara',
				'We found a locked storage room containing supplies that will help us for the rest of the year. This has given us great hope. Fifteen more supply cubes into the stockpile—now and every month ahead—plus four actions right now!',
				{ listener: 'kai', verbatim: true, cue: 'victory' },
			),
		],
	},

	'door:17': {
		id: 'door:17',
		act: 'Turning Point #3 · The Truth of the Faded',
		title: 'An Exchange of Secrets',
		subtitle: 'Door 17 · Hollow Men Defect',
		setPiece: 'fadedTruth',
		beats: [
			beat(
				'door17_01',
				'vey',
				'They told us to fear you. Told us you were monsters from the old plague—that you deserved death. And here you are, feeding the cities Utopia left to burn.',
				{ listener: 'mara', cue: 'doorTear', setPiece: 'fadedTruth' },
			),
			beat(
				'door17_02',
				'tomas',
				'We are, after all, the Faded—quarantined to the havens after COdA. The vaccine created seventy years ago keeps our minds normal; it is only our skin that is forever changed. Seventy years of helping humanity and they still hate us.',
				{ listener: 'vey', verbatim: true },
			),
			beat(
				'door17_03',
				'mara',
				'Some of our fellow Faded are disgusted we brought Hollow Men onto the havens and have left us. We think this was the right move. Open Door 58—we can now build a plan to get into Utopia.',
				{ listener: 'vey', verbatim: true },
			),
		],
	},

	'door:18': {
		id: 'door:18',
		act: 'Buenos Aires · OPAL Lab',
		title: 'The Immunologist Joins',
		subtitle: 'Doors 18 & 20 · OPAL Laboratory',
		beats: [
			beat(
				'door18_01',
				'amaya',
				"Finally, someone from the havens. Have you found our leaders? They've been gone since the summit. We stopped broadcasting on satellite towers since it attracted the Hollow Men. I'm continuing the work of my grandfather—we made a breakthrough at OPAL that can help, and Lake Baikal is where PEARL stood.",
				{ listener: 'tomas', verbatim: true, cue: 'doorTear' },
			),
		],
	},

	'door:19': {
		id: 'door:19',
		act: 'Wellington · TOPAZ Lab',
		title: 'Untouched by the Plague',
		subtitle: 'Door 19 & Door 41 · TOPAZ Laboratory',
		beats: [
			beat(
				'door19_01',
				'amaya',
				'Found TOPAZ lab in Wellington. Cut off from the rest of the world for nearly fifty years, they were surprised to see us! No haven presence, no Hollow Men, and no trace of the plague. One brave Vector Control Expert agreed to come with us—and confirmed the location of PEARL in Lake Baikal.',
				{ listener: 'mara', verbatim: true, cue: 'doorTear' },
			),
		],
	},

	'door:20': {
		id: 'door:20',
		act: 'Southern Hemisphere Lab Contact',
		title: "You've Found Us",
		subtitle: 'Door 20 · Breakthroughs & Lake Baikal',
		beats: [
			beat(
				'door20_01',
				'amaya',
				"Finally, someone from the havens. We made a breakthrough that should help, and I know the other labs have as well. Some of our scientists left to visit Lake Baikal, since that's where PEARL—the primary lab—was located. Although no one has heard from them for decades now...",
				{ listener: 'tomas', verbatim: true, cue: 'doorTear' },
			),
		],
	},

	'door:21': {
		id: 'door:21',
		act: 'Europe · Catastrophe',
		title: 'Reign of Terror — Frankfurt Destroyed',
		subtitle: 'Door 21 · City Obliterated',
		setPiece: 'frankfurtDestroyed',
		beats: [
			beat(
				'door21_01',
				'chronicler',
				'Smoke rises over the heart of Europe. Frankfurt is gone—burned off the chart, its cards reduced to ash.',
				{ cue: 'cityDestroyed', setPiece: 'frankfurtDestroyed' },
			),
			beat(
				'door21_02',
				'kai',
				'Frankfurt no longer exists on the map and cannot become part of the grid. Destroy every Frankfurt Player and Infection card. No supply line may ever cross that crater.',
				{ listener: 'mara', verbatim: true },
			),
		],
	},

	'door:22': {
		id: 'door:22',
		act: 'Lake Baikal · PEARL Lab',
		title: 'The Carrier Sacrifice',
		subtitle: 'Doors 22, Q, 38, 27, 32 · Self-Infect',
		setPiece: 'selfInfect',
		beats: [
			beat(
				'door22_01',
				'amaya',
				"We've found PEARL lab in Lake Baikal! Scientists are here, isolated by Utopia. They have samples of a cure—we need to get it to JADE. Utopia patrols are everywhere. It's too dangerous to carry it in the open.",
				{ listener: 'mara', verbatim: true, cue: 'vialClink', setPiece: 'selfInfect' },
			),
			beat(
				'door22_02',
				'tomas',
				"We need to inject a massive dose of the sample into ourselves—carry it in our own bodies. A dose that large will certainly kill the carrier. We have exactly four doses. Once they're gone, they're gone.",
				{ listener: 'amaya', verbatim: true, cue: 'exposureScar' },
			),
		],
	},

	'door:35': {
		id: 'door:35',
		act: 'Signals Triangulated',
		title: 'What You Hear',
		subtitle: 'Door 35 · Hollow Men Frequencies',
		beats: [
			beat(
				'door35_01',
				'kai',
				"Triangulation complete! We've picked up chatter from the Hollow Men. They primarily use three frequencies: 9.2, 9.31, and 11.88. Once the satellite towers are fully operational around August, we can listen right in.",
				{ listener: 'mara', verbatim: true, cue: 'radioDecode' },
			),
		],
	},

	'door:46': {
		id: 'door:46',
		act: 'Johannesburg · JADE Lab',
		title: 'The Production Facility',
		subtitle: 'Door 46 · Scientist Joins',
		beats: [
			beat(
				'door46_01',
				'amaya',
				'A second-generation scientist fighting against world-wide diseases. JADE was built to mass-produce a cure—our equipment still runs. Bring us a supply center and the sample from PEARL, and we can save everyone.',
				{ listener: 'tomas', verbatim: true, cue: 'doorTear' },
			),
		],
	},

	'door:43': {
		id: 'door:43',
		act: 'Frequency 11.88 Decrypted',
		title: 'Transmissions Decrypted',
		subtitle: 'Door 43 · Decryption Key',
		beats: [
			beat(
				'door43_01',
				'kai',
				"We've managed to decrypt an important transmission that will help us avoid the Hollow Men. Decryption Key added to our City card improvements!",
				{ listener: 'mara', verbatim: true, cue: 'radioDecode' },
			),
		],
	},

	'door:52': {
		id: 'door:52',
		act: 'Frequency 9.2 Decoded',
		title: 'Patrol Routes Into East Asia',
		subtitle: 'Door 52 · Transmissions Decoded',
		beats: [
			beat(
				'door52_01',
				'kai',
				"We have decoded the Hollow Men's transmissions! We now know their patrol routes and can sneak right past them into East Asia—five unique black cards from a supply center in Kolkata!",
				{ listener: 'mara', verbatim: true, cue: 'radioDecode' },
			),
		],
	},

	'search:shanghai:land': {
		id: 'search:shanghai:land',
		act: 'Shanghai Search',
		title: 'Outside the Walls of Utopia',
		subtitle: 'Field Discovery · Shanghai',
		setPiece: 'shanghaiMassacre',
		beats: [
			beat(
				'search_shanghai_01',
				'kai',
				'We found the Haven leaders. Dead. Unburied. Shot outside the walls of Utopia where they petitioned to get in. There were no survivors. Utopia accepts no outsiders. Utopia leaves no survivors.',
				{ listener: 'mara', verbatim: true, setPiece: 'shanghaiMassacre' },
			),
		],
	},

	'search:atlanta:land': {
		id: 'search:atlanta:land',
		act: 'Atlanta Search',
		title: 'Ruins of the CDC',
		subtitle: 'Field Discovery · Atlanta',
		beats: [
			beat(
				'search_atlanta_01',
				'tomas',
				"The plague that broke the world started here. A group blew up the CDC, destroying the COdA virus, but releasing a plague that couldn't be stopped. Not sure what prompted this action—or if they knew what would result from it.",
				{ listener: 'mara', verbatim: true, cue: 'scratch' },
			),
		],
	},

	'search:new-mumbai:land': {
		id: 'search:new-mumbai:land',
		act: 'New Mumbai Search',
		title: 'Down Near the Water',
		subtitle: 'Field Discovery · New Mumbai',
		beats: [
			beat(
				'search_mumbai_01',
				'kai',
				'Saw one of the Hollow Men down near the water. He was sketching, drawing pictures of a family. Mother. Kids. The father was clearly an image of him. He was crying silently. We kept our distance.',
				{ listener: 'tomas', style: 'thought', verbatim: true },
			),
		],
	},

	'search:moscow:land': {
		id: 'search:moscow:land',
		act: 'Moscow Search',
		title: 'The Glowing Sky East',
		subtitle: 'Field Discovery · Moscow',
		beats: [
			beat(
				'search_moscow_01',
				'kai',
				'Locals still bitter their leaders left them decades ago for a "Utopia" in the east. A week after their train left, the sky to the east started glowing. They led us to Smolensk to report our findings.',
				{ listener: 'mara', verbatim: true, cue: 'scratch' },
			),
		],
	},

	'search:khartoum:land': {
		id: 'search:khartoum:land',
		act: 'Khartoum Search',
		title: 'Faded Were Not Welcome',
		subtitle: 'Field Discovery · Khartoum',
		beats: [
			beat(
				'search_khartoum_01',
				'archive',
				'Posters in the abandoned broadcast facility talk of Utopia, which will keep mankind safe until the plague has passed. It was accepting petitions before its gates closed. Faded were not welcome.',
				{ listener: 'kai', style: 'radio', verbatim: true },
			),
		],
	},

	'search:santiago:land': {
		id: 'search:santiago:land',
		act: 'Santiago Search',
		title: 'Haunted by Despair',
		subtitle: 'Field Discovery · Santiago',
		beats: [
			beat(
				'search_santiago_01',
				'tomas',
				"This is a town haunted by despair. A surge of refugees overwhelmed the city's resources. Plague is rampant. Must not stay.",
				{ listener: 'mara', verbatim: true, cue: 'exposureScar' },
			),
		],
	},

	'search:bogota:land': {
		id: 'search:bogota:land',
		act: 'Bogotá Search',
		title: 'No Solace',
		subtitle: 'Field Discovery · Bogotá',
		beats: [
			beat(
				'search_bogota_01',
				'mara',
				'Locals say the haven off the coast was abandoned decades ago. Haven staff fled to Bogotá, but found no solace due to their appearance. We moved on without comment.',
				{ listener: 'tomas', verbatim: true },
			),
		],
	},

	'search:riyadh:land': {
		id: 'search:riyadh:land',
		act: 'Riyadh Search',
		title: 'Heading Into Darkness',
		subtitle: 'Field Discovery · Riyadh',
		beats: [
			beat(
				'search_riyadh_01',
				'kai',
				'Hollow Men have headquarters here. The whole city lives in fear of them. They come from Asia and new members appear every year in November. We must tread carefully. We are heading into darkness.',
				{ listener: 'mara', verbatim: true },
			),
		],
	},

	'search:buenos-aires:land': {
		id: 'search:buenos-aires:land',
		act: 'Buenos Aires Search',
		title: 'OPAL Laboratory Found',
		subtitle: 'Field Discovery · Buenos Aires',
		beats: [
			beat(
				'search_ba_01',
				'tomas',
				'Found OPAL laboratory, one of four labs seeking a cure! Someone at the lab has offered to join us—open Doors 18 and 20!',
				{ listener: 'amaya', verbatim: true, cue: 'victory' },
			),
		],
	},

	'search:johannesburg:land': {
		id: 'search:johannesburg:land',
		act: 'Johannesburg Search',
		title: 'JADE Laboratory Found',
		subtitle: 'Field Discovery · Johannesburg',
		beats: [
			beat(
				'search_jhb_01',
				'amaya',
				'Found JADE laboratory, mostly abandoned—there is one holdout who offered to join us. The production equipment is still functional. Bring a supply center and a sample to start production.',
				{ listener: 'mara', verbatim: true, cue: 'victory' },
			),
		],
	},
};

const RAID_CARDS: Record<string, { seal: SealKey }> = {
	'02-01': { seal: 'package:1' },
	'04-01': { seal: 'package:5' },
	'05-01': { seal: 'door:60' },
	'06-01': { seal: 'package:4' },
	'07-01': { seal: 'package:7' },
	'08-01': { seal: 'package:2' },
	'09-01': { seal: 'door:65' },
	'10-01': { seal: 'package:3' },
	'11-01': { seal: 'door:17' },
	'12-01': { seal: 'package:8' },
};

/** Resolves the voiced narrative scene for a given `Opening` step in `Unboxing.svelte`. */
export function sceneForOpening(opening: Opening, campaign?: Campaign): StoryScene | null {
	if (opening.from.t === 'legacy') {
		const id = opening.from.card;
		if (id in RAID_CARDS && campaign) {
			const forced = campaign.forced.includes(RAID_CARDS[id]!.seal);
			if (!forced) return null;
		}
		if (id === '03-01' && campaign && !campaign.scratched.includes('03-01:1')) return null;
		if (STORY_SCENES[id]) return STORY_SCENES[id]!;
		// Check if any door opened inside this step carries a headline scene (e.g., Door 21 in 06-01).
		for (const seal of opening.seals) {
			const key = seal.t === 'package' ? `pkg:${seal.id}` : `door:${seal.id}`;
			if (STORY_SCENES[key]) return STORY_SCENES[key]!;
		}
		return null;
	}
	if (opening.from.t === 'seal') {
		const primary = opening.from.seal.t === 'package' ? `pkg:${opening.from.seal.id}` : `door:${opening.from.seal.id}`;
		if (STORY_SCENES[primary]) return STORY_SCENES[primary]!;
		for (const seal of opening.seals) {
			const key = seal.t === 'package' ? `pkg:${seal.id}` : `door:${seal.id}`;
			if (STORY_SCENES[key]) return STORY_SCENES[key]!;
		}
	}
	return null;
}

export function sceneForSearch(city: CityId, scope: 'land' | 'sea'): StoryScene | null {
	return STORY_SCENES[`search:${city}:${scope}`] ?? null;
}

/** Lists every unlocked story scene so players can replay any past moment from the Story Log. */
export function unlockedStoryScenes(campaign: Campaign): StoryScene[] {
	const out: StoryScene[] = [STORY_SCENES.prelude!];
	const openSeals = new Set<string>(campaign.opened);
	const add = (id: string) => {
		const scene = STORY_SCENES[id];
		if (scene && !out.includes(scene)) out.push(scene);
	};
	for (const id of Object.keys(STORY_SCENES)) {
		if (id === 'prelude') continue;
		if (id.startsWith('pkg:')) {
			if (openSeals.has(`package:${id.slice(4)}`)) add(id);
		} else if (id.startsWith('door:')) {
			if (openSeals.has(`door:${id.slice(5)}`)) add(id);
		} else if (id.startsWith('search:')) {
			const [, city, scope] = id.split(':');
			const scratched = Object.values(campaign.playerCards).some(
				card =>
					card.kind === 'city' && card.city === city && card.search.some(box => box.scope === scope && box.scratched),
			);
			if (scratched) add(id);
		} else {
			const monthNum = Number(id.slice(0, 2));
			if (!Number.isNaN(monthNum) && monthNum <= campaign.month) {
				if (id in RAID_CARDS) {
					if (campaign.forced.includes(RAID_CARDS[id]!.seal)) add(id);
				} else if (id === '12-06') {
					if (campaign.legacyIndex >= 74 && !campaign.sampleDelivered) add(id);
				} else if (id === '12-07') {
					if (campaign.legacyIndex >= 75 && campaign.sampleDelivered) add(id);
				} else if (id === '12-05') {
					if (campaign.legacyIndex >= 74) add(id);
				} else {
					add(id);
				}
			}
		}
	}
	return out;
}

/** Every spoken beat across the whole game — used by scripts/gen-voices.ts to synthesize ElevenLabs audio. */
export function allVoiceBeats(): { sceneId: string; beat: StoryBeat }[] {
	const list: { sceneId: string; beat: StoryBeat }[] = [];
	for (const scene of Object.values(STORY_SCENES)) {
		for (const entry of scene.beats) list.push({ sceneId: scene.id, beat: entry });
	}
	return list;
}

/** Verbatim ending story text for Final Reckoning score bands. */
export const ENDING_TIERS = {
	delivered: [
		{
			min: 851,
			label: '851 and above',
			text: 'Our work brought the world back from disaster! Cities are growing. People have hope. Our leaders lost faith, but we never did. The 21st century will be remembered as a time of darkness, but there is now light ahead. The Hollow Men have been freed. We, the Faded, are finally free from our exile on the havens.',
		},
		{
			min: 701,
			label: '701–850',
			text: 'We have persevered. Some cities were saved. Civilization has been rekindled. Faded, non-Faded, Hollow Men: we hope to find a way to co-exist. The world will move on, hopefully for the better, although some cities may never recover.',
		},
		{
			min: 551,
			label: '551–700',
			text: "Despite our inexperience, we did the impossible. The world has paid the price of our leaders' fear, Utopia's malice, and the Hollow Men's savagery. But we have a cure! We believe that the world will recover in time. There will be new cities and new countries. Who knows how long it will take to rebuild, but we will be part of it.",
		},
		{
			min: 401,
			label: '401–550',
			text: "We didn't want to be back on the front lines so soon, but the world is a disaster. There is rioting, anarchy, near collapse. Without Utopia in the east, those cities have risen up. We have a cure, but we're not sure the world will survive long enough to use it. Some cities will make it. We hope the world can rebuild from there.",
		},
		{
			min: Number.NEGATIVE_INFINITY,
			label: '400 and below',
			text: '"I hope someone finds this note. The mistrust between Faded and normal humans was too much for the world. We were overwhelmed. There is a cure, but it may be too little, too late. Our efforts were great, but the burden was too heavy. We tried. We tried." — Found in ruins of North Atlantic Haven',
		},
	],
	failed: [
		{
			min: 851,
			label: '851 and above',
			text: "We saved the world, just not ourselves. The 21st century will be remembered as a time of darkness, but there is now light ahead. Utopia has the cure and will now produce it at JADE. They just won't give it to us. The Hollow Men have been freed. The Faded won't be here to see this new world, but we hope that history will remember us as its saviors.",
		},
		{
			min: 701,
			label: '701–850',
			text: "We have persevered. Some cities were saved. Civilization has been rekindled. Utopia and the Hollow Men are at war with each other. One of them will bring the sample to JADE and start producing a cure. We don't expect either to share it with us. All we know is that we kept the world going when everyone else had given up.",
		},
		{
			min: 551,
			label: '551–700',
			text: "Despite our inexperience, we did the impossible. The world has paid the price of our leaders' fear, Utopia's malice, and the Hollow Men's savagery. We are paying the price for failing to get the sample. We believe that the world will recover in time. There will be new cities and new countries. We hope they remember what we did.",
		},
		{
			min: 401,
			label: '401–550',
			text: "The world is a disaster. There is rioting, anarchy, near collapse. Without Utopia in the east, those cities have risen up. We have no cure. We're not sure the world would survive long enough to use it. Some cities will make it. We hope the world can rebuild from there. We will be gone soon.",
		},
		{
			min: Number.NEGATIVE_INFINITY,
			label: '400 and below',
			text: '"I hope someone finds this note. The mistrust between Faded and normal humans was too much for the world. We were overwhelmed. Utopia may save the humans... but not us. Our efforts were great, but the burden was too heavy. We tried. We failed." — Found in ruins of North Atlantic Haven',
		},
	],
} as const;

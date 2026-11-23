#!/usr/bin/env python3
"""Regenerate src/data/exercise-sources.md from render/exercises.json (run render/export-exercises.cjs first).
Sources are keyed by movement pattern; each exercise lists at least two."""
import json, os

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
EX = json.load(open(os.path.join(ROOT, 'render', 'exercises.json')))
NAME = {e['id']: e['name'] for e in EX}

S = {
 # ExRx exercise directories (muscle-by-muscle target/synergist listings)
 'XC': ('ExRx: chest exercise directory (target and synergist muscles)', 'https://exrx.net/Lists/ExList/ChestWt'),
 'XB': ('ExRx: back exercise directory', 'https://exrx.net/Lists/ExList/BackWt'),
 'XS': ('ExRx: shoulder exercise directory', 'https://exrx.net/Lists/ExList/ShouldWt'),
 'XA': ('ExRx: upper-arm exercise directory', 'https://exrx.net/Lists/ExList/ArmWt'),
 'XF': ('ExRx: forearm exercise directory', 'https://exrx.net/Lists/ExList/ForeArmWt'),
 'XT': ('ExRx: thigh exercise directory', 'https://exrx.net/Lists/ExList/ThighWt'),
 'XH': ('ExRx: hip exercise directory', 'https://exrx.net/Lists/ExList/HipsWt'),
 'XL': ('ExRx: calf exercise directory', 'https://exrx.net/Lists/ExList/CalfWt'),
 'XW': ('ExRx: waist (abdominal) exercise directory', 'https://exrx.net/Lists/ExList/WaistWt'),
 # Studies / professional bodies
 'BENCH': ('L\u00f3pez-Vivancos & Gonz\u00e1lez-G\u00e1lvez 2023, pectoralis major EMG in bench press and variants: systematic review and meta-analysis, Applied Sciences 13(8):5203', 'https://www.mdpi.com/2076-3417/13/8/5203'),
 'PUSHUP': ('Calatayud et al. 2015, bench press and push-ups at comparable levels of muscle activity give similar strength gains (J Strength Cond Res)', 'https://pubmed.ncbi.nlm.nih.gov/24983847/'),
 'PUSHVAR': ('Push-up variations and muscle activation (PubMed 26488636)', 'https://pubmed.ncbi.nlm.nih.gov/26488636/'),
 'INCLINE': ('Non-uniform pectoralis major excitation across bench angles (PubMed 34644424)', 'https://pubmed.ncbi.nlm.nih.gov/34644424/'),
 'ACECHEST': ('ACE-sponsored chest exercise EMG study (bench, pec deck, cable crossover)', 'https://www.acefitness.org/certifiednewsarticle/2884/'),
 'OHP1': ('Barbell vs dumbbell vs machine shoulder press muscle activity (PMC9354811)', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC9354811/'),
 'OHP2': ('Saeterbakken & Fimland 2013, body position and modality in shoulder press (PubMed 23096062)', 'https://pubmed.ncbi.nlm.nih.gov/23096062/'),
 'LATRAISE': ('Dumbbell vs cable lateral raise, Frontiers in Physiology 2025', 'https://doi.org/10.3389/fphys.2025.1611468'),
 'PULLDOWN1': ('Lat pulldown grip variations EMG (PubMed 19855327)', 'https://pubmed.ncbi.nlm.nih.gov/19855327/'),
 'PULLDOWN2': ('Chin-up / pull-up vs lat pulldown muscle activation (PubMed 24245055)', 'https://pubmed.ncbi.nlm.nih.gov/24245055/'),
 'PULLDOWN3': ('Front vs behind-neck pulldown (PMC11057623)', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11057623/'),
 'ACETRI': ('ACE-sponsored triceps EMG study (pushdowns, kickbacks, dips)', 'https://www.acefitness.org/certifiednewsarticle/1562/'),
 'MAEO22': ('Maeo et al. 2022, overhead vs arms-at-side triceps extension hypertrophy (PubMed 35819335)', 'https://pubmed.ncbi.nlm.nih.gov/35819335/'),
 'ACEBI': ('ACE-sponsored biceps EMG study (concentration curl, cable curl, chin-up)', 'https://www.acefitness.org/certifiednewsarticle/4933/'),
 'GRIP': ('Biceps and brachioradialis excitation with supinated, neutral and pronated curls (PubMed 36976950)', 'https://pubmed.ncbi.nlm.nih.gov/36976950/'),
 'SQUAT': ('Squat variations EMG review (PMC7831128)', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC7831128/'),
 'LUNGE': ('Monopodal squat, forward lunge and step-up EMG (PMC7112217)', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC7112217/'),
 'BULG': ('Muscle activity of the Bulgarian squat, PLOS ONE 2019', 'https://doi.org/10.1371/journal.pone.0221710'),
 'ACEGLUTE': ('ACE: strength training the glutes, an evidence-based approach', 'https://www.acefitness.org/resources/pros/expert-articles/8807/strength-training-the-glutes-an-evidence-based-approach/'),
 'RDL': ('Conventional deadlift vs Romanian deadlift EMG (PubMed 30662500)', 'https://pubmed.ncbi.nlm.nih.gov/30662500/'),
 'HEX': ('Camara et al. 2016, hexagonal (trap) bar vs straight bar deadlift (PubMed 26840440)', 'https://pubmed.ncbi.nlm.nih.gov/26840440/'),
 'SBSTRAP': ('Stronger by Science: trap bar deadlifts', 'https://strongerbyscience.com/trap-bar-deadlifts/'),
 'MAEO21': ('Maeo et al. 2021, seated vs prone leg curl hypertrophy (PubMed 33009197)', 'https://pubmed.ncbi.nlm.nih.gov/33009197/'),
 'THRUST': ('Hip thrust vs back squat glute EMG, Contreras et al. 2015 (PubMed 26214739)', 'https://pubmed.ncbi.nlm.nih.gov/26214739/'),
 'BRIDGE': ('Glute bridge vs hip thrust (PubMed 35586943)', 'https://pubmed.ncbi.nlm.nih.gov/35586943/'),
 'PLOTKIN': ('Plotkin et al. 2023, hip thrust and back squat give similar glute hypertrophy (PMC10593473)', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC10593473/'),
 'CALF': ('Kinoshita et al. 2023, seated vs standing calf raise training, Frontiers in Physiology', 'https://doi.org/10.3389/fphys.2023.1272106'),
 'ACEABS': ('ACE-sponsored abdominal exercise EMG study (captain’s chair, crunch variations)', 'https://www.acefitness.org/getfit/studies/BestWorstAbExercises.pdf'),
 'ESCAMILLA': ('Escamilla et al. 2006, abdominal exercise EMG incl. roll-outs and hanging knee-ups (PubMed 16649890)', 'https://pubmed.ncbi.nlm.nih.gov/16649890/'),
}

PATTERN = {
 'h_press': ['XC', 'BENCH', 'PUSHUP', 'ACECHEST'], 'incline_press': ['XC', 'INCLINE', 'BENCH'], 'fly': ['XC', 'ACECHEST'],
 'dip': ['XC', 'XA', 'ACETRI'], 'v_press': ['XS', 'OHP1', 'OHP2'], 'lat_raise': ['XS', 'LATRAISE'], 'front_raise': ['XS', 'OHP2'],
 'rear_delt': ['XS', 'XB'], 'v_pull': ['XB', 'PULLDOWN1', 'PULLDOWN2', 'PULLDOWN3'], 'h_pull': ['XB', 'PULLDOWN2'],
 'pullover': ['XB', 'PULLDOWN1'], 'shrug': ['XB', 'XS'], 'tri_ext': ['XA', 'ACETRI', 'MAEO22'], 'tri_overhead': ['XA', 'MAEO22'],
 'curl': ['XA', 'ACEBI', 'GRIP'], 'hammer': ['XA', 'XF', 'GRIP'], 'wrist_flex': ['XF', 'GRIP'], 'wrist_ext': ['XF', 'GRIP'],
 'carry': ['XF', 'XB'], 'squat': ['XT', 'SQUAT', 'THRUST'], 'lunge': ['XT', 'LUNGE', 'BULG', 'ACEGLUTE'],
 'hinge': ['XH', 'RDL', 'HEX', 'SBSTRAP'], 'knee_ext': ['XT', 'SQUAT'], 'knee_flex': ['XT', 'MAEO21', 'RDL'],
 'hip_ext': ['XH', 'THRUST', 'BRIDGE', 'PLOTKIN'], 'calf': ['XL', 'CALF'], 'core_flex': ['XW', 'ACEABS'],
 'core_hip': ['XW', 'ACEABS', 'ESCAMILLA'], 'core_brace': ['XW', 'ESCAMILLA'],
}

TEMPLATES = [
 ('Upper Body 5-Day (Injury)', 'Your original split, unchanged. Twice-weekly frequency per muscle', ['Schoenfeld et al. 2016, training frequency meta-analysis (PubMed 27102172)|https://pubmed.ncbi.nlm.nih.gov/27102172/', 'Stronger by Science: training frequency|https://www.strongerbyscience.com/frequency/']),
 ('Push / Pull / Legs (6 days)', 'Each muscle twice a week; heavy compound first', ['Weightology: push/pull/legs|https://weightology.net/?p=7788', 'Outlift: the 6-day workout split|https://outlift.com/6-day-workout-split/', 'Schoenfeld et al. 2016 (PubMed 27102172)|https://pubmed.ncbi.nlm.nih.gov/27102172/']),
 ('PPL + Upper / Lower (5 days)', 'PPL then upper and lower days', ['StrengthLog: PPLUL split|https://www.strengthlog.com/pplul-split/', 'Hevy: PPLUL split|https://www.hevyapp.com/pplul-split/']),
 ('Upper / Lower (4 days)', 'PHUL-style power and hypertrophy days', ['Muscle & Strength: PHUL|https://www.muscleandstrength.com/workouts/phul-workout', 'Liftosaur: PHUL|https://www.liftosaur.com/programs/phul']),
 ('Full Body (3 days)', 'Whole body 3x a week', ['NSCA: determination of resistance training frequency|https://www.nsca.com/education/articles/determination_of_resistance_training_frequency/', 'ACSM position stand, progression models in resistance training (PubMed 19204579)|https://pubmed.ncbi.nlm.nih.gov/19204579/']),
 ('Bro Split (5 days)', 'One body part per day', ['Liftosaur: bro split (cites Gomes et al. 2018, volume-equated split vs full body)|https://www.liftosaur.com/programs/bro-split', 'Muscle & Strength: the ultimate bro split|https://www.muscleandstrength.com/workouts/the-ultimate-bro-split']),
 ('Arnold Split (6 days)', 'Chest/back, shoulders/arms, legs twice a week', ['StrengthLog: the Arnold split|https://www.strengthlog.com/arnold-split/', 'Liftosaur: Arnold split|https://www.liftosaur.com/programs/arnold-split']),
]

L = ['# Exercise and program sources', '',
     'Generated by `scripts/gen-exercise-sources.py`. Every exercise and swap lists at least two sources:',
     'an ExRx directory that lists the exercise’s target and synergist muscles, plus EMG / training studies',
     'or professional-body (ACE, NSCA, ACSM) material for the movement pattern. Swap pairs share a pattern and',
     'primary muscle, so the same evidence supports both sides of the swap. Rest rule: 2 min on heavy compounds,',
     '90 s otherwise ([Singer et al. 2024](https://doi.org/10.3389/fspor.2024.1429789)).', '', '## Programs', '']
for name, note, srcs in TEMPLATES:
    L.append(f'- **{name}**: {note}. ' + '; '.join(f'[{t}]({u})' for t, u in (s.split('|') for s in srcs)))
L += ['', '## Exercises and swaps', '', '| Exercise | Muscles (primary / secondary) | Researched swaps | Sources |', '|---|---|---|---|']
for e in sorted(EX, key=lambda e: e['name']):
    keys = PATTERN[e['pattern']]
    sw = ', '.join(f"{NAME[s['id']]} ({'same' if s['match']=='same' else 'close'})" for s in (e['swaps'] or [])) or 'pattern match'
    mus = ', '.join(e['primary']) + ' / ' + (', '.join(e['secondary']) or '–')
    L.append(f"| {e['name']} | {mus} | {sw} | {', '.join(f'[{k}]' for k in keys)} |")
L += ['', '## Bibliography', '']
for k, (t, u) in S.items():
    L.append(f'- **[{k}]** {t}: {u}')
L += ['', '## Images', '',
      'How-to photos: [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (Unlicense / public domain).',
      'No images from paid illustration sets, TikTok/Instagram or other gym apps are used.', '',
      'Missing images (no matching free-exercise-db entry): Cable Fly, Heavy Dumbbell Hold.', '']
open(os.path.join(ROOT, 'src', 'data', 'exercise-sources.md'), 'w').write('\n'.join(L))
print('ok', len(EX))

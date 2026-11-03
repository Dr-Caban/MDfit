# MD Fit Media Library (Cloudinary)

Generated 2026-11-03 by `node scripts/build-media-manifest.js`. Cloud: **rvrfmvmm**. Every asset lives under `mdfit/`.
Spreadsheet version: [media-library.csv](media-library.csv). Machine version: `frontend/data/media-manifest.json`.

**Totals:** 275 assets · 163 videos · 112 images
**By purpose:** exercise-library 155 · pain-track 3 · pain-pattern 28 · app-intro 3 · lecture 2 · protocol-sheet 8 · branding 5 · guide 21 · pain-map 28 · program-cover 22

## How it's organized

- **Folders** go purpose → region → category, so editors can open one folder and see everything of one kind.
- **File names** are the exercise or image name in plain words (`rotator-cuff-external-rotation`); pain-track videos are prefixed with level and order (`level-1-02-...`) so they sort in workout order.
- **Display name** in the Media Library is the human title.
- **Tags** (filter in Cloudinary search): `type:video|image`, `purpose:*`, `region:*`, `kind:*`, `category:*`, `library-category:*`, `level:1–9`, `location:*`, `joint:*`, `muscle:*`, `pain-track:*`, `stage:*`, `file-code:*`, `protocol:*`, `week:*`, `guide:*`, `view:*`, `program:*`, `seated`.
- **Contextual metadata** on each asset: name, purpose, region, category, level, location, joint, muscle, pain track, stage, order, original file code, original Google Drive ID, minutes/topic for lectures.
- Videos over 100 MB are stored as a 720p H.264 copy (plays on every phone); the original stays in Google Drive (see Drive ID).

## Folder tree

```
mdfit/  (275)
  images/  (112)
    branding/  (5)
    guides/  (21)
      calf/  (3)
      iliopsoas/  (3)
      lateral-hip/  (3)
      posterior-neck/  (3)
      quads/  (3)
      rotator-cuff/  (3)
      scalenes/  (3)
    pain-map/  (28)
      clean-sources/  (23)
    pain-patterns/  (28)
      Abdomen/  (1)
        external-oblique-to-abdominal-wall/  (1)
      Calf/  (1)
        calf-soleus-to-calf-heel-and-plantar-complex/  (1)
      Chest/  (5)
        pec-major-to-chest-and-front-of-shoulder/  (2)
        pec-minor-third-rib-to-upper-chest-and-front-of-shoulder/  (2)
        scalenes-to-front-of-the-chest/  (1)
      Foot/  (1)
        foot-to-sole-heel-and-arch/  (1)
      Forearm/  (3)
        extensor-carpi-radialis-to-outer-forearm-and-elbow/  (1)
        general-radialis-brachioradialis-to-forearm-and-thumb-side/  (1)
        pronator-medial-forearm-to-inner-forearm-and-elbow/  (1)
      Glutes/  (2)
        gluteus-maximus-to-back-of-hip-and-sacrum/  (1)
        gluteus-minimus-to-side-of-hip-and-si-region/  (1)
      Hip/  (1)
        general-hip-pain-front-side-or-back/  (1)
      Hip-and-groin/  (3)
        groin-to-adductor-rotational-referral/  (1)
        iliacus-to-front-of-hip-and-pelvis/  (1)
        pectineus-to-front-of-groin-and-upper-inner-thigh/  (1)
      Knee/  (1)
        knee-to-referred-knee-pain/  (1)
      Low-back/  (1)
        quadratus-lumborum-to-low-back-and-back-of-pelvis/  (1)
      Low-back-and-hip/  (1)
        psoas-to-front-of-hip-and-deep-low-back/  (1)
      Neck-and-shoulder/  (2)
        levator-scapulae-to-upper-shoulder-blade/  (1)
        scalenes-to-neck-shoulder-blade-and-deltoid/  (1)
      Ribs/  (1)
        serratus-anterior-to-side-ribs-and-shoulder-blade/  (1)
      Shoulder/  (4)
        anterior-deltoid-to-front-of-the-shoulder/  (1)
        infraspinatus-to-back-and-deep-front-of-the-shoulder/  (1)
        subscapularis-to-front-of-shoulder-and-deep-cuff/  (1)
        supraspinatus-to-top-and-outside-of-the-shoulder/  (1)
      Upper-arm/  (1)
        triceps-to-back-of-the-arm/  (1)
    programs/  (22)
    protocols/  (8)
      golfers-elbow/  (4)
      tennis-elbow/  (4)
  videos/  (163)
    app-intros/  (3)
    exercise-library/  (155)
      Exercise/  (86)
        Arms/  (4)
          Strength/  (4)
        Core/  (5)
          Power/  (3)
          Strength/  (2)
        Full-body/  (18)
          Activation/  (1)
          Mobility/  (9)
          Power/  (6)
          Strength/  (2)
        Hips/  (22)
          Mobility/  (8)
          Strength/  (14)
        Knees/  (1)
          Strength/  (1)
        Legs/  (6)
          Activation/  (3)
          Mobility/  (2)
          Power/  (1)
        Shoulders/  (22)
          Activation/  (3)
          Mobility/  (4)
          Strength/  (15)
        Spine/  (6)
          Activation/  (2)
          Mobility/  (4)
        Upper-body/  (2)
          Strength/  (2)
      Rehab/  (69)
        Ankles/  (2)
          Mobility/  (1)
          Rehab/  (1)
        Desk-and-posture/  (3)
          Desk-and-posture/  (1)
          Lifestyle/  (2)
        Full-body/  (1)
          Neuroglide/  (1)
        Hips/  (18)
          Activation/  (4)
          Mobility/  (12)
          Rehab/  (2)
        Knees/  (2)
          Mobility/  (1)
          Rehab/  (1)
        Legs/  (4)
          Activation/  (4)
        Neck/  (14)
          Activation/  (3)
          Mobility/  (4)
          Neuroglide/  (1)
          Posture/  (2)
          Rehab/  (4)
        Shoulders/  (10)
          Activation/  (3)
          Mobility/  (2)
          Rehab/  (5)
        Spine/  (12)
          Mobility/  (12)
        Wrists/  (3)
          Activation/  (1)
          Rehab/  (2)
    lectures/  (2)
    pain-tracks/  (3)
      Chest/  (2)
        scalenes-to-front-of-the-chest/  (2)
      Neck-and-shoulder/  (1)
        scalenes-to-neck-shoulder-blade-and-deltoid/  (1)
```

## Assets

### Exercise library videos (155)

| Display name | Cloudinary path | Details |
|---|---|---|
| Ankle Neuroglide | `mdfit/videos/exercise-library/Rehab/Ankles/Mobility/ankle-neuroglide` | kind: Rehab · region: Ankles · category: Mobility · library category: Rehabilitation · level: 2 · location: Anywhere · joint: Ankles & feet · muscle: Calves & feet · seated: no |
| Eccentric Calf Drops | `mdfit/videos/exercise-library/Rehab/Ankles/Rehab/eccentric-calf-drops` | kind: Rehab · region: Ankles · category: Rehab · library category: Rehabilitation · level: 2 · location: Anywhere · joint: Ankles & feet · muscle: Calves & feet · seated: no · pain tracks: Foot → sole, heel & arch; Calf / soleus → calf, heel & plantar complex · file code: AN_CO_ECCENTRIC_CALF_DROPS_RHB |
| Bicep Curl | `mdfit/videos/exercise-library/Exercise/Arms/Strength/bicep-curl` | kind: Exercise · region: Arms · category: Strength · library category: Strength training · level: 2 · location: Anywhere · joint: Elbows · muscle: Biceps · seated: no |
| Overhead Tricep Extension | `mdfit/videos/exercise-library/Exercise/Arms/Strength/overhead-tricep-extension` | kind: Exercise · region: Arms · category: Strength · library category: Strength training · level: 5 · location: Anywhere · joint: Elbows · muscle: Triceps · seated: no |
| Tricep Extension | `mdfit/videos/exercise-library/Exercise/Arms/Strength/tricep-extension` | kind: Exercise · region: Arms · category: Strength · library category: Strength training · level: 3 · location: Anywhere · joint: Elbows · muscle: Triceps · seated: no |
| Tricep Kickback | `mdfit/videos/exercise-library/Exercise/Arms/Strength/tricep-kickback` | kind: Exercise · region: Arms · category: Strength · library category: Strength training · level: 4 · location: Gym · joint: Elbows · muscle: Triceps · seated: no |
| Blaster Deadlift Press | `mdfit/videos/exercise-library/Exercise/Core/Power/blaster-deadlift-press` | kind: Exercise · region: Core · category: Power · library category: Specialty movements · level: 4 · location: Gym · joint: Core · muscle: Shoulders (delts & cuff) · seated: no |
| Dead Bug | `mdfit/videos/exercise-library/Exercise/Core/Strength/dead-bug` | kind: Exercise · region: Core · category: Strength · library category: Strength training · level: 1 · location: Anywhere · joint: Core · muscle: Core & abs · seated: no · pain tracks: Gluteus minimus → side of hip & SI region · file code: CO_CO_DEAD_BUG_STR |
| Dynamic Plank | `mdfit/videos/exercise-library/Exercise/Core/Strength/dynamic-plank` | kind: Exercise · region: Core · category: Strength · library category: Strength training · level: 3 · location: Home · joint: Core · muscle: Core & abs · seated: no |
| Landmine Press Twist | `mdfit/videos/exercise-library/Exercise/Core/Power/landmine-press-twist` | kind: Exercise · region: Core · category: Power · library category: Specialty movements · level: 6 · location: Gym · joint: Core · muscle: Shoulders (delts & cuff) · seated: no |
| Med Ball Slam | `mdfit/videos/exercise-library/Exercise/Core/Power/med-ball-slam` | kind: Exercise · region: Core · category: Power · library category: Specialty movements · level: 5 · location: Gym · joint: Core · muscle: Core & abs · seated: no |
| Desk Setup Tutorial | `mdfit/videos/exercise-library/Rehab/Desk-and-posture/Desk-and-posture/desk-setup-tutorial` | kind: Rehab · region: Desk & posture · category: Desk & posture · library category: Rehabilitation · level: 1 · location: Anywhere · joint: Desk & lifestyle · muscle: Full body · seated: yes |
| Walk Break Protocol Seated | `mdfit/videos/exercise-library/Rehab/Desk-and-posture/Lifestyle/walk-break-protocol-seated` | kind: Rehab · region: Desk & posture · category: Lifestyle · library category: Rehabilitation · level: 1 · location: Anywhere · joint: Desk & lifestyle · muscle: Full body · seated: yes |
| Water Habit Cue | `mdfit/videos/exercise-library/Rehab/Desk-and-posture/Lifestyle/water-habit-cue` | kind: Rehab · region: Desk & posture · category: Lifestyle · library category: Rehabilitation · level: 1 · location: Anywhere · joint: Desk & lifestyle · muscle: Full body · seated: yes |
| Burpee | `mdfit/videos/exercise-library/Exercise/Full-body/Mobility/burpee` | kind: Exercise · region: Full body · category: Mobility · library category: Specialty movements · level: 4 · location: Anywhere · joint: Full body · muscle: Full body · seated: no |
| DB Clean | `mdfit/videos/exercise-library/Exercise/Full-body/Power/db-clean` | kind: Exercise · region: Full body · category: Power · library category: Specialty movements · level: 5 · location: Anywhere · joint: Full body · muscle: Full body · seated: no |
| DB Lunge Clean | `mdfit/videos/exercise-library/Exercise/Full-body/Power/db-lunge-clean` | kind: Exercise · region: Full body · category: Power · library category: Specialty movements · level: 7 · location: Anywhere · joint: Full body · muscle: Quads · seated: no |
| DB Lunge Thruster | `mdfit/videos/exercise-library/Exercise/Full-body/Power/db-lunge-thruster` | kind: Exercise · region: Full body · category: Power · library category: Specialty movements · level: 7 · location: Anywhere · joint: Full body · muscle: Quads · seated: no |
| DB Snatch | `mdfit/videos/exercise-library/Exercise/Full-body/Mobility/db-snatch` | kind: Exercise · region: Full body · category: Mobility · library category: Specialty movements · level: 8 · location: Anywhere · joint: Full body · muscle: Full body · seated: no |
| Front Crab Walk | `mdfit/videos/exercise-library/Exercise/Full-body/Mobility/front-crab-walk` | kind: Exercise · region: Full body · category: Mobility · library category: Specialty movements · level: 4 · location: Home · joint: Full body · muscle: Full body · seated: no |
| Full Neuroglide Flow Seated | `mdfit/videos/exercise-library/Rehab/Full-body/Neuroglide/full-neuroglide-flow-seated` | kind: Rehab · region: Full body · category: Neuroglide · library category: Rehabilitation · level: 2 · location: Anywhere · joint: Full body · muscle: Full body · seated: yes |
| Jump Switch Lunge | `mdfit/videos/exercise-library/Exercise/Full-body/Power/jump-switch-lunge` | kind: Exercise · region: Full body · category: Power · library category: Specialty movements · level: 5 · location: Home · joint: Full body · muscle: Quads · seated: no |
| Med Ball Over Shoulder | `mdfit/videos/exercise-library/Exercise/Full-body/Power/med-ball-over-shoulder` | kind: Exercise · region: Full body · category: Power · library category: Specialty movements · level: 5 · location: Anywhere · joint: Full body · muscle: Shoulders (delts & cuff) · seated: no |
| Power Clean | `mdfit/videos/exercise-library/Exercise/Full-body/Power/power-clean` | kind: Exercise · region: Full body · category: Power · library category: Specialty movements · level: 6 · location: Anywhere · joint: Full body · muscle: Full body · seated: no |
| Row | `mdfit/videos/exercise-library/Exercise/Full-body/Activation/row` | kind: Exercise · region: Full body · category: Activation · library category: Strength training · level: 3 · location: Anywhere · joint: Full body · muscle: Back & lats · seated: no |
| Side Crab Walk | `mdfit/videos/exercise-library/Exercise/Full-body/Mobility/side-crab-walk` | kind: Exercise · region: Full body · category: Mobility · library category: Specialty movements · level: 5 · location: Home · joint: Full body · muscle: Full body · seated: no |
| Single Arm DB Pistol Squat | `mdfit/videos/exercise-library/Exercise/Full-body/Strength/single-arm-db-pistol-squat` | kind: Exercise · region: Full body · category: Strength · library category: Strength training · level: 9 · location: Home · joint: Full body · muscle: Quads · seated: no |
| Spider Kick | `mdfit/videos/exercise-library/Exercise/Full-body/Mobility/spider-kick` | kind: Exercise · region: Full body · category: Mobility · library category: Specialty movements · level: 6 · location: Home · joint: Full body · muscle: Full body · seated: no |
| Sprawl Half Burpee | `mdfit/videos/exercise-library/Exercise/Full-body/Mobility/sprawl-half-burpee` | kind: Exercise · region: Full body · category: Mobility · library category: Specialty movements · level: 5 · location: Anywhere · joint: Full body · muscle: Full body · seated: no |
| Thruster | `mdfit/videos/exercise-library/Exercise/Full-body/Strength/thruster` | kind: Exercise · region: Full body · category: Strength · library category: Strength training · level: 6 · location: Anywhere · joint: Full body · muscle: Full body · seated: no |
| Turkish Get Up | `mdfit/videos/exercise-library/Exercise/Full-body/Mobility/turkish-get-up` | kind: Exercise · region: Full body · category: Mobility · library category: Specialty movements · level: 7 · location: Home · joint: Full body · muscle: Core & abs · seated: no |
| Wall Ball | `mdfit/videos/exercise-library/Exercise/Full-body/Mobility/wall-ball` | kind: Exercise · region: Full body · category: Mobility · library category: Specialty movements · level: 5 · location: Anywhere · joint: Full body · muscle: Full body · seated: no |
| Wall Burpee | `mdfit/videos/exercise-library/Exercise/Full-body/Mobility/wall-burpee` | kind: Exercise · region: Full body · category: Mobility · library category: Specialty movements · level: 8 · location: Anywhere · joint: Full body · muscle: Full body · seated: no |
| 90/90 Hip Switch | `mdfit/videos/exercise-library/Rehab/Hips/Mobility/90-90-hip-switch` | kind: Rehab · region: Hips · category: Mobility · library category: Mobility · level: 2 · location: Anywhere · joint: Hips · muscle: Glutes · seated: no · pain tracks: Quadratus lumborum → low back & back of pelvis; General hip pain (front, side or back); Gluteus minimus → side of hip & SI region · file code: HP_RT_9090_HIP_SWITCH_MOB |
| Bodyweight Squat | `mdfit/videos/exercise-library/Exercise/Hips/Strength/bodyweight-squat` | kind: Exercise · region: Hips · category: Strength · library category: Strength training · level: 4 · location: Home · joint: Hips · muscle: Quads · seated: no · pain tracks: Iliacus → front of hip & pelvis; Psoas → front of hip & deep low back · file code: HP_SQ_BODYWEIGHT_SQUAT_STR |
| Bulgarian Split Squat | `mdfit/videos/exercise-library/Exercise/Hips/Mobility/bulgarian-split-squat` | kind: Exercise · region: Hips · category: Mobility · library category: Strength training · level: 7 · location: Anywhere · joint: Hips · muscle: Quads · seated: no |
| Bulgarian Split Squat Hold | `mdfit/videos/exercise-library/Exercise/Hips/Strength/bulgarian-split-squat-hold` | kind: Exercise · region: Hips · category: Strength · library category: Strength training · level: 6 · location: Home · joint: Hips · muscle: Quads · seated: no |
| Cable Pull Through | `mdfit/videos/exercise-library/Exercise/Hips/Strength/cable-pull-through` | kind: Exercise · region: Hips · category: Strength · library category: Strength training · level: 4 · location: Anywhere · joint: Hips · muscle: Hamstrings · seated: no |
| Constant Glute Engagement | `mdfit/videos/exercise-library/Rehab/Hips/Activation/constant-glute-engagement` | kind: Rehab · region: Hips · category: Activation · library category: Rehabilitation · level: 2 · location: Anywhere · joint: Hips · muscle: Glutes · seated: no · pain tracks: Iliacus → front of hip & pelvis; Psoas → front of hip & deep low back · file code: HP_ACT_CONSTANT_GLUTE_ENGAGEMENT_ACT |
| Cossack Squat | `mdfit/videos/exercise-library/Exercise/Hips/Mobility/cossack-squat` | kind: Exercise · region: Hips · category: Mobility · library category: Strength training · level: 6 · location: Home · joint: Hips · muscle: Glutes · seated: no · pain tracks: Iliacus → front of hip & pelvis; Psoas → front of hip & deep low back; Pectineus → front of groin & upper inner thigh · file code: HP_SQ_COSSACK_SQUAT_MOB |
| Couch Stretch | `mdfit/videos/exercise-library/Rehab/Hips/Mobility/couch-stretch` | kind: Rehab · region: Hips · category: Mobility · library category: Stretching · level: 2 · location: Anywhere · joint: Hips · muscle: Hip flexors · seated: no |
| DB Overhead Surrender | `mdfit/videos/exercise-library/Rehab/Hips/Mobility/db-overhead-surrender` | kind: Rehab · region: Hips · category: Mobility · library category: Stretching · level: 7 · location: Anywhere · joint: Hips · muscle: Shoulders (delts & cuff) · seated: no |
| Deadlift | `mdfit/videos/exercise-library/Exercise/Hips/Strength/deadlift` | kind: Exercise · region: Hips · category: Strength · library category: Strength training · level: 6 · location: Anywhere · joint: Hips · muscle: Hamstrings · seated: no |
| Dowel Hip Hinge | `mdfit/videos/exercise-library/Exercise/Hips/Strength/dowel-hip-hinge` | kind: Exercise · region: Hips · category: Strength · library category: Strength training · level: 4 · location: Anywhere · joint: Hips · muscle: Hamstrings · seated: no |
| Dynamic Childs Pose | `mdfit/videos/exercise-library/Rehab/Hips/Mobility/dynamic-childs-pose` | kind: Rehab · region: Hips · category: Mobility · library category: Stretching · level: 2 · location: Anywhere · joint: Hips · muscle: Upper back & spine · seated: no |
| Front Split Ballistic | `mdfit/videos/exercise-library/Exercise/Hips/Mobility/front-split-ballistic` | kind: Exercise · region: Hips · category: Mobility · library category: Specialty movements · level: 8 · location: Anywhere · joint: Hips · muscle: Hip flexors & hamstrings · seated: no |
| Front Squat | `mdfit/videos/exercise-library/Exercise/Hips/Strength/front-squat` | kind: Exercise · region: Hips · category: Strength · library category: Strength training · level: 7 · location: Gym · joint: Hips · muscle: Quads · seated: no |
| Glute RDL | `mdfit/videos/exercise-library/Exercise/Hips/Strength/glute-rdl` | kind: Exercise · region: Hips · category: Strength · library category: Strength training · level: 6 · location: Gym · joint: Hips · muscle: Hamstrings · seated: no |
| Glute Walk | `mdfit/videos/exercise-library/Rehab/Hips/Activation/glute-walk` | kind: Rehab · region: Hips · category: Activation · library category: Rehabilitation · level: 1 · location: Anywhere · joint: Hips · muscle: Glutes · seated: no · pain tracks: Iliacus → front of hip & pelvis; Psoas → front of hip & deep low back; General hip pain (front, side or back); Knee → referred knee pain · file code: HP_GT_GLUTE_WALK_ACT |
| Goblet Sumo Squat | `mdfit/videos/exercise-library/Exercise/Hips/Strength/goblet-sumo-squat` | kind: Exercise · region: Hips · category: Strength · library category: Strength training · level: 6 · location: Gym · joint: Hips · muscle: Quads · seated: no |
| High Kick Heavy Bag | `mdfit/videos/exercise-library/Exercise/Hips/Mobility/high-kick-heavy-bag` | kind: Exercise · region: Hips · category: Mobility · library category: Specialty movements · level: 7 · location: Gym · joint: Hips · muscle: Full body · seated: no |
| Hip Neuroglide | `mdfit/videos/exercise-library/Rehab/Hips/Mobility/hip-neuroglide` | kind: Rehab · region: Hips · category: Mobility · library category: Rehabilitation · level: 2 · location: Anywhere · joint: Hips · muscle: Glutes · seated: no |
| Hip Thrust | `mdfit/videos/exercise-library/Exercise/Hips/Mobility/hip-thrust` | kind: Exercise · region: Hips · category: Mobility · library category: Strength training · level: 3 · location: Home · joint: Hips · muscle: Glutes · seated: no · pain tracks: General hip pain (front, side or back) · file code: HP_HN_HIP_THRUST_MOB |
| Kettlebell Swing | `mdfit/videos/exercise-library/Exercise/Hips/Mobility/kettlebell-swing` | kind: Exercise · region: Hips · category: Mobility · library category: Strength training · level: 5 · location: Anywhere · joint: Hips · muscle: Hamstrings · seated: no |
| Lunges | `mdfit/videos/exercise-library/Exercise/Hips/Strength/lunges` | kind: Exercise · region: Hips · category: Strength · library category: Strength training · level: 3 · location: Home · joint: Hips · muscle: Quads · seated: no |
| Pillow Belt Reset | `mdfit/videos/exercise-library/Rehab/Hips/Rehab/pillow-belt-reset` | kind: Rehab · region: Hips · category: Rehab · library category: Rehabilitation · level: 2 · location: Anywhere · joint: Hips · muscle: Hip flexors · seated: no · pain tracks: Gluteus maximus → back of hip & sacrum; Gluteus minimus → side of hip & SI region · file code: HP_MOB_PILLOW_BELT_RESET_RHB |
| Pistol Squat | `mdfit/videos/exercise-library/Exercise/Hips/Mobility/pistol-squat` | kind: Exercise · region: Hips · category: Mobility · library category: Specialty movements · level: 7 · location: Home · joint: Hips · muscle: Quads · seated: no |
| Pole Squat | `mdfit/videos/exercise-library/Rehab/Hips/Mobility/pole-squat` | kind: Rehab · region: Hips · category: Mobility · library category: Stretching · level: 7 · location: Gym · joint: Hips · muscle: Quads · seated: no |
| Quadruped Glute Kick | `mdfit/videos/exercise-library/Rehab/Hips/Activation/quadruped-glute-kick` | kind: Rehab · region: Hips · category: Activation · library category: Rehabilitation · level: 1 · location: Anywhere · joint: Hips · muscle: Glutes · seated: no |
| Rack Pull | `mdfit/videos/exercise-library/Exercise/Hips/Strength/rack-pull` | kind: Exercise · region: Hips · category: Strength · library category: Strength training · level: 5 · location: Anywhere · joint: Hips · muscle: Back & lats · seated: no |
| Romanian Deadlift | `mdfit/videos/exercise-library/Exercise/Hips/Strength/romanian-deadlift` | kind: Exercise · region: Hips · category: Strength · library category: Strength training · level: 5 · location: Anywhere · joint: Hips · muscle: Hamstrings · seated: no · pain tracks: Gluteus maximus → back of hip & sacrum; Gluteus minimus → side of hip & SI region; Knee → referred knee pain · file code: HP_HN_ROMANIAN_DEADLIFT_STR |
| Single Leg Glute Bridge | `mdfit/videos/exercise-library/Rehab/Hips/Activation/single-leg-glute-bridge` | kind: Rehab · region: Hips · category: Activation · library category: Rehabilitation · level: 4 · location: Home · joint: Hips · muscle: Glutes · seated: no |
| Standing Clamshell | `mdfit/videos/exercise-library/Rehab/Hips/Mobility/standing-clamshell` | kind: Rehab · region: Hips · category: Mobility · library category: Rehabilitation · level: 2 · location: Anywhere · joint: Hips · muscle: Glutes · seated: no · pain tracks: General hip pain (front, side or back); Gluteus maximus → back of hip & sacrum; Gluteus minimus → side of hip & SI region · file code: HP_RT_STANDING_CLAMSHELL_MOB |
| Standing Hip Abduction/Adduction | `mdfit/videos/exercise-library/Rehab/Hips/Mobility/standing-hip-abduction-adduction` | kind: Rehab · region: Hips · category: Mobility · library category: Mobility · level: 2 · location: Anywhere · joint: Hips · muscle: Glutes · seated: no · pain tracks: General hip pain (front, side or back); Gluteus maximus → back of hip & sacrum; Gluteus minimus → side of hip & SI region · file code: HP_AB_STANDING_HIP_ABAD_MOB |
| Standing Hip CARs | `mdfit/videos/exercise-library/Rehab/Hips/Mobility/standing-hip-cars` | kind: Rehab · region: Hips · category: Mobility · library category: Rehabilitation · level: 2 · location: Anywhere · joint: Hips · muscle: Glutes · seated: no |
| Standing Hip ER Liftoff | `mdfit/videos/exercise-library/Rehab/Hips/Mobility/standing-hip-er-liftoff` | kind: Rehab · region: Hips · category: Mobility · library category: Rehabilitation · level: 2 · location: Anywhere · joint: Hips · muscle: Glutes · seated: no · pain tracks: Iliacus → front of hip & pelvis · file code: HP_RT_STANDING_HIP_ER_LIFTOFF_MOB |
| Standing Hip IR Liftoff | `mdfit/videos/exercise-library/Rehab/Hips/Mobility/standing-hip-ir-liftoff` | kind: Rehab · region: Hips · category: Mobility · library category: Rehabilitation · level: 2 · location: Anywhere · joint: Hips · muscle: Glutes · seated: no · pain tracks: Iliacus → front of hip & pelvis · file code: HP_RT_STANDING_HIP_IR_LIFTOFF_MOB |
| Step Up | `mdfit/videos/exercise-library/Exercise/Hips/Strength/step-up` | kind: Exercise · region: Hips · category: Strength · library category: Strength training · level: 3 · location: Gym · joint: Hips · muscle: Quads · seated: no |
| Straight Leg Deadlift | `mdfit/videos/exercise-library/Exercise/Hips/Strength/straight-leg-deadlift` | kind: Exercise · region: Hips · category: Strength · library category: Strength training · level: 4 · location: Anywhere · joint: Hips · muscle: Hamstrings · seated: no · pain tracks: Gluteus maximus → back of hip & sacrum; Gluteus minimus → side of hip & SI region · file code: HP_HN_STRAIGHT_LEG_DEADLIFT_STR |
| Sumo Deadlift | `mdfit/videos/exercise-library/Exercise/Hips/Strength/sumo-deadlift` | kind: Exercise · region: Hips · category: Strength · library category: Strength training · level: 6 · location: Gym · joint: Hips · muscle: Hamstrings · seated: no |
| Surrender | `mdfit/videos/exercise-library/Rehab/Hips/Mobility/surrender` | kind: Rehab · region: Hips · category: Mobility · library category: Stretching · level: 6 · location: Home · joint: Hips · muscle: Hip flexors · seated: no |
| TRX Squat | `mdfit/videos/exercise-library/Exercise/Hips/Mobility/trx-squat` | kind: Exercise · region: Hips · category: Mobility · library category: Strength training · level: 3 · location: Gym · joint: Hips · muscle: Quads · seated: no · pain tracks: Iliacus → front of hip & pelvis; Psoas → front of hip & deep low back · file code: HP_SQ_TRX_SQUAT_MOB |
| Table Eccentric Hip Drop | `mdfit/videos/exercise-library/Rehab/Hips/Rehab/table-eccentric-hip-drop` | kind: Rehab · region: Hips · category: Rehab · library category: Rehabilitation · level: 2 · location: Anywhere · joint: Hips · muscle: Hip flexors · seated: no |
| Knee Circles | `mdfit/videos/exercise-library/Rehab/Knees/Rehab/knee-circles` | kind: Rehab · region: Knees · category: Rehab · library category: Rehabilitation · level: 2 · location: Anywhere · joint: Knees · muscle: Quads · seated: no · pain tracks: Knee → referred knee pain · file code: KN_MOB_KNEE_CIRCLES_RHB |
| Knee Neuroglide | `mdfit/videos/exercise-library/Rehab/Knees/Mobility/knee-neuroglide` | kind: Rehab · region: Knees · category: Mobility · library category: Rehabilitation · level: 2 · location: Anywhere · joint: Knees · muscle: Quads · seated: no |
| Sissy Squat | `mdfit/videos/exercise-library/Exercise/Knees/Strength/sissy-squat` | kind: Exercise · region: Knees · category: Strength · library category: Strength training · level: 8 · location: Home · joint: Knees · muscle: Quads · seated: no · pain tracks: Knee → referred knee pain · file code: KN_SQ_SISSY_SQUAT_STR |
| 40m Dash | `mdfit/videos/exercise-library/Exercise/Legs/Mobility/40m-dash` | kind: Exercise · region: Legs · category: Mobility · library category: Specialty movements · level: 5 · location: Outdoor · joint: Knees · muscle: Full body · seated: no |
| Assault Bike | `mdfit/videos/exercise-library/Exercise/Legs/Activation/assault-bike` | kind: Exercise · region: Legs · category: Activation · library category: Specialty movements · level: 2 · location: Gym · joint: Knees · muscle: Full body · seated: no |
| Box Jump | `mdfit/videos/exercise-library/Exercise/Legs/Mobility/box-jump` | kind: Exercise · region: Legs · category: Mobility · library category: Specialty movements · level: 7 · location: Gym · joint: Knees · muscle: Quads · seated: no |
| Heel Walk | `mdfit/videos/exercise-library/Rehab/Legs/Activation/heel-walk` | kind: Rehab · region: Legs · category: Activation · library category: Rehabilitation · level: 1 · location: Home · joint: Ankles & feet · muscle: Calves & feet · seated: no · pain tracks: Foot → sole, heel & arch · file code: AN_GT_HEEL_WALK_ACT |
| Jump Rope | `mdfit/videos/exercise-library/Exercise/Legs/Activation/jump-rope` | kind: Exercise · region: Legs · category: Activation · library category: Specialty movements · level: 3 · location: Outdoor · joint: Ankles & feet · muscle: Calves & feet · seated: no |
| Long Jump | `mdfit/videos/exercise-library/Exercise/Legs/Power/long-jump` | kind: Exercise · region: Legs · category: Power · library category: Specialty movements · level: 5 · location: Home · joint: Knees · muscle: Quads · seated: no |
| March Balance | `mdfit/videos/exercise-library/Rehab/Legs/Activation/march-balance` | kind: Rehab · region: Legs · category: Activation · library category: Rehabilitation · level: 2 · location: Anywhere · joint: Ankles & feet · muscle: Full body · seated: no |
| Single Leg Balance | `mdfit/videos/exercise-library/Rehab/Legs/Activation/single-leg-balance` | kind: Rehab · region: Legs · category: Activation · library category: Rehabilitation · level: 2 · location: Anywhere · joint: Ankles & feet · muscle: Full body · seated: no |
| Sled Push Pull | `mdfit/videos/exercise-library/Exercise/Legs/Activation/sled-push-pull` | kind: Exercise · region: Legs · category: Activation · library category: Specialty movements · level: 6 · location: Gym · joint: Knees · muscle: Quads · seated: no |
| Toe Walk | `mdfit/videos/exercise-library/Rehab/Legs/Activation/toe-walk` | kind: Rehab · region: Legs · category: Activation · library category: Rehabilitation · level: 1 · location: Home · joint: Ankles & feet · muscle: Calves & feet · seated: no · pain tracks: Calf / soleus → calf, heel & plantar complex · file code: LB_GT_TOE_WALK_ACT |
| 90/90 Breathing | `mdfit/videos/exercise-library/Rehab/Neck/Mobility/90-90-breathing` | kind: Rehab · region: Neck · category: Mobility · library category: Stretching · level: 2 · location: Anywhere · joint: Neck · muscle: Upper back & spine · seated: no |
| Box Breathing | `mdfit/videos/exercise-library/Rehab/Neck/Mobility/box-breathing` | kind: Rehab · region: Neck · category: Mobility · library category: Stretching · level: 2 · location: Anywhere · joint: Neck · muscle: Upper back & spine · seated: no |
| Chin Glide Seated | `mdfit/videos/exercise-library/Rehab/Neck/Activation/chin-glide-seated` | kind: Rehab · region: Neck · category: Activation · library category: Rehabilitation · level: 2 · location: Anywhere · joint: Neck · muscle: Neck & traps · seated: yes |
| Core Brace Intro Seated | `mdfit/videos/exercise-library/Rehab/Neck/Activation/core-brace-intro-seated` | kind: Rehab · region: Neck · category: Activation · library category: Rehabilitation · level: 2 · location: Anywhere · joint: Neck · muscle: Core & abs · seated: yes |
| Deep Cervical Flexor Nods Seated | `mdfit/videos/exercise-library/Rehab/Neck/Activation/deep-cervical-flexor-nods-seated` | kind: Rehab · region: Neck · category: Activation · library category: Rehabilitation · level: 2 · location: Anywhere · joint: Neck · muscle: Neck & traps · seated: yes |
| Eccentric Scalene Drop | `mdfit/videos/exercise-library/Rehab/Neck/Rehab/eccentric-scalene-drop` | kind: Rehab · region: Neck · category: Rehab · library category: Rehabilitation · level: 2 · location: Anywhere · joint: Neck · muscle: Neck & traps · seated: no · pain tracks: Scalenes → front of the chest; Scalenes → neck, shoulder blade & deltoid; Supraspinatus → top & outside of the shoulder; Infraspinatus → back & deep front of the shoulder · file code: NK_MOB_ECCENTRIC_SCALENE_DROP_RHB |
| Levator Scap Stretch Seated | `mdfit/videos/exercise-library/Rehab/Neck/Mobility/levator-scap-stretch-seated` | kind: Rehab · region: Neck · category: Mobility · library category: Stretching · level: 2 · location: Anywhere · joint: Neck · muscle: Neck & traps · seated: yes |
| Neck Neuroglide Seated | `mdfit/videos/exercise-library/Rehab/Neck/Neuroglide/neck-neuroglide-seated` | kind: Rehab · region: Neck · category: Neuroglide · library category: Rehabilitation · level: 2 · location: Anywhere · joint: Neck · muscle: Neck & traps · seated: yes |
| SCM Release Seated | `mdfit/videos/exercise-library/Rehab/Neck/Rehab/scm-release-seated` | kind: Rehab · region: Neck · category: Rehab · library category: Stretching · level: 2 · location: Anywhere · joint: Neck · muscle: Neck & traps · seated: yes |
| Seated Desk Posture Reset | `mdfit/videos/exercise-library/Rehab/Neck/Posture/seated-desk-posture-reset` | kind: Rehab · region: Neck · category: Posture · library category: Rehabilitation · level: 1 · location: Anywhere · joint: Neck · muscle: Upper back & spine · seated: yes |
| Standing Posture Reset | `mdfit/videos/exercise-library/Rehab/Neck/Posture/standing-posture-reset` | kind: Rehab · region: Neck · category: Posture · library category: Rehabilitation · level: 1 · location: Anywhere · joint: Neck · muscle: Upper back & spine · seated: no |
| Standing Scalene Stretch | `mdfit/videos/exercise-library/Rehab/Neck/Rehab/standing-scalene-stretch` | kind: Rehab · region: Neck · category: Rehab · library category: Stretching · level: 2 · location: Anywhere · joint: Neck · muscle: Neck & traps · seated: no · pain tracks: Scalenes → front of the chest; Pec minor / third rib → upper chest & front of shoulder · file code: NK_MOB_STANDING_SCALENE_STRETCH_RHB |
| Towel Neck Stretch Eccentric | `mdfit/videos/exercise-library/Rehab/Neck/Rehab/towel-neck-stretch-eccentric` | kind: Rehab · region: Neck · category: Rehab · library category: Stretching · level: 2 · location: Anywhere · joint: Neck · muscle: Neck & traps · seated: no |
| Upper Trap Stretch Seated | `mdfit/videos/exercise-library/Rehab/Neck/Mobility/upper-trap-stretch-seated` | kind: Rehab · region: Neck · category: Mobility · library category: Stretching · level: 2 · location: Anywhere · joint: Neck · muscle: Neck & traps · seated: yes |
| Abducted External Rotation | `mdfit/videos/exercise-library/Rehab/Shoulders/Rehab/abducted-external-rotation` | kind: Rehab · region: Shoulders · category: Rehab · library category: Rehabilitation · level: 2 · location: Anywhere · joint: Shoulders · muscle: Shoulders (delts & cuff) · seated: no · pain tracks: Infraspinatus → back & deep front of the shoulder · file code: SH_RT_ABDUCTED_EXTERNAL_ROTATION_RHB |
| Abducted Internal Rotation | `mdfit/videos/exercise-library/Rehab/Shoulders/Rehab/abducted-internal-rotation` | kind: Rehab · region: Shoulders · category: Rehab · library category: Rehabilitation · level: 2 · location: Anywhere · joint: Shoulders · muscle: Shoulders (delts & cuff) · seated: no · pain tracks: Infraspinatus → back & deep front of the shoulder · file code: SH_RT_ABDUCTED_INTERNAL_ROTATION_RHB |
| Assisted Muscle Up | `mdfit/videos/exercise-library/Exercise/Shoulders/Mobility/assisted-muscle-up` | kind: Exercise · region: Shoulders · category: Mobility · library category: Specialty movements · level: 8 · location: Gym · joint: Shoulders · muscle: Back & lats · seated: no |
| Bench Press | `mdfit/videos/exercise-library/Exercise/Shoulders/Strength/bench-press` | kind: Exercise · region: Shoulders · category: Strength · library category: Strength training · level: 5 · location: Gym · joint: Shoulders · muscle: Chest · seated: no |
| Dips | `mdfit/videos/exercise-library/Exercise/Shoulders/Strength/dips` | kind: Exercise · region: Shoulders · category: Strength · library category: Strength training · level: 3 · location: Home · joint: Shoulders · muscle: Triceps · seated: no |
| Dumbbell Row | `mdfit/videos/exercise-library/Exercise/Shoulders/Strength/dumbbell-row` | kind: Exercise · region: Shoulders · category: Strength · library category: Strength training · level: 4 · location: Gym · joint: Shoulders · muscle: Back & lats · seated: no |
| Eccentric Push Up | `mdfit/videos/exercise-library/Exercise/Shoulders/Strength/eccentric-push-up` | kind: Exercise · region: Shoulders · category: Strength · library category: Strength training · level: 3 · location: Home · joint: Shoulders · muscle: Chest · seated: no · pain tracks: Pec major → chest & front of shoulder; Anterior deltoid → front of the shoulder · file code: SH_PU_ECCENTRIC_PUSH_UP_STR |
| Face Pull | `mdfit/videos/exercise-library/Exercise/Shoulders/Activation/face-pull` | kind: Exercise · region: Shoulders · category: Activation · library category: Strength training · level: 5 · location: Gym · joint: Shoulders · muscle: Back & lats · seated: no |
| Floor Slide Scapular Retract | `mdfit/videos/exercise-library/Rehab/Shoulders/Activation/floor-slide-scapular-retract` | kind: Rehab · region: Shoulders · category: Activation · library category: Rehabilitation · level: 2 · location: Anywhere · joint: Shoulders · muscle: Back & lats · seated: no |
| Handstand Push Up | `mdfit/videos/exercise-library/Exercise/Shoulders/Mobility/handstand-push-up` | kind: Exercise · region: Shoulders · category: Mobility · library category: Specialty movements · level: 8 · location: Home · joint: Shoulders · muscle: Shoulders (delts & cuff) · seated: no |
| Incline Bench Press | `mdfit/videos/exercise-library/Exercise/Shoulders/Strength/incline-bench-press` | kind: Exercise · region: Shoulders · category: Strength · library category: Strength training · level: 6 · location: Gym · joint: Shoulders · muscle: Chest · seated: no |
| Lat Pulldown | `mdfit/videos/exercise-library/Exercise/Shoulders/Strength/lat-pulldown` | kind: Exercise · region: Shoulders · category: Strength · library category: Strength training · level: 3 · location: Gym · joint: Shoulders · muscle: Back & lats · seated: no |
| Lat To Front Raise | `mdfit/videos/exercise-library/Exercise/Shoulders/Activation/lat-to-front-raise` | kind: Exercise · region: Shoulders · category: Activation · library category: Strength training · level: 5 · location: Gym · joint: Shoulders · muscle: Back & lats · seated: no |
| Lateral Raise | `mdfit/videos/exercise-library/Exercise/Shoulders/Strength/lateral-raise` | kind: Exercise · region: Shoulders · category: Strength · library category: Strength training · level: 3 · location: Gym · joint: Shoulders · muscle: Shoulders (delts & cuff) · seated: no |
| Overhead Straight Arm Pulldown | `mdfit/videos/exercise-library/Exercise/Shoulders/Mobility/overhead-straight-arm-pulldown` | kind: Exercise · region: Shoulders · category: Mobility · library category: Strength training · level: 6 · location: Gym · joint: Shoulders · muscle: Back & lats · seated: no |
| Pegboard Climb | `mdfit/videos/exercise-library/Exercise/Shoulders/Mobility/pegboard-climb` | kind: Exercise · region: Shoulders · category: Mobility · library category: Specialty movements · level: 9 · location: Gym · joint: Shoulders · muscle: Back & lats · seated: no |
| Pike Push Up | `mdfit/videos/exercise-library/Exercise/Shoulders/Strength/pike-push-up` | kind: Exercise · region: Shoulders · category: Strength · library category: Strength training · level: 7 · location: Home · joint: Shoulders · muscle: Shoulders (delts & cuff) · seated: no |
| Pull Up | `mdfit/videos/exercise-library/Exercise/Shoulders/Strength/pull-up` | kind: Exercise · region: Shoulders · category: Strength · library category: Strength training · level: 7 · location: Gym · joint: Shoulders · muscle: Back & lats · seated: no |
| Push Press | `mdfit/videos/exercise-library/Exercise/Shoulders/Activation/push-press` | kind: Exercise · region: Shoulders · category: Activation · library category: Strength training · level: 5 · location: Gym · joint: Shoulders · muscle: Shoulders (delts & cuff) · seated: no |
| Push Up | `mdfit/videos/exercise-library/Exercise/Shoulders/Strength/push-up` | kind: Exercise · region: Shoulders · category: Strength · library category: Strength training · level: 5 · location: Home · joint: Shoulders · muscle: Chest · seated: no |
| Rotator Cuff 90 Band Vibration | `mdfit/videos/exercise-library/Rehab/Shoulders/Activation/rotator-cuff-90-band-vibration` | kind: Rehab · region: Shoulders · category: Activation · library category: Rehabilitation · level: 2 · location: Anywhere · joint: Shoulders · muscle: Shoulders (delts & cuff) · seated: no · pain tracks: Subscapularis → front of shoulder & deep cuff; Infraspinatus → back & deep front of the shoulder · file code: SH_RT_90_DEG_CUFF_FAN_VIBRATION_RHB |
| Rotator Cuff External Rotation | `mdfit/videos/exercise-library/Rehab/Shoulders/Rehab/rotator-cuff-external-rotation` | kind: Rehab · region: Shoulders · category: Rehab · library category: Rehabilitation · level: 2 · location: Anywhere · joint: Shoulders · muscle: Shoulders (delts & cuff) · seated: no · pain tracks: Subscapularis → front of shoulder & deep cuff; Anterior deltoid → front of the shoulder; Infraspinatus → back & deep front of the shoulder · file code: SH_RT_ROTATOR_CUFF_EXTERNAL_ROTATION_RHB |
| Rotator Cuff Internal Rotation | `mdfit/videos/exercise-library/Rehab/Shoulders/Rehab/rotator-cuff-internal-rotation` | kind: Rehab · region: Shoulders · category: Rehab · library category: Rehabilitation · level: 2 · location: Anywhere · joint: Shoulders · muscle: Shoulders (delts & cuff) · seated: no · pain tracks: Subscapularis → front of shoulder & deep cuff; Anterior deltoid → front of the shoulder; Infraspinatus → back & deep front of the shoulder · file code: SH_RT_ROTATOR_CUFF_INTERNAL_ROTATION_RHB |
| Scap Push Ups | `mdfit/videos/exercise-library/Exercise/Shoulders/Strength/scap-push-ups` | kind: Exercise · region: Shoulders · category: Strength · library category: Strength training · level: 3 · location: Home · joint: Shoulders · muscle: Shoulders (delts & cuff) · seated: no · pain tracks: Levator scapulae → upper shoulder blade · file code: SH_SC_SCAPULAR_PUSH_UP_ACT |
| Scapular CARs | `mdfit/videos/exercise-library/Rehab/Shoulders/Mobility/scapular-cars` | kind: Rehab · region: Shoulders · category: Mobility · library category: Rehabilitation · level: 2 · location: Anywhere · joint: Shoulders · muscle: Shoulders (delts & cuff) · seated: no · pain tracks: Levator scapulae → upper shoulder blade · file code: SH_RT_SCAPULAR_CARS_MOB |
| Scapular Clavicle Articulation Posterior | `mdfit/videos/exercise-library/Rehab/Shoulders/Activation/scapular-clavicle-articulation-posterior` | kind: Rehab · region: Shoulders · category: Activation · library category: Rehabilitation · level: 2 · location: Anywhere · joint: Shoulders · muscle: Shoulders (delts & cuff) · seated: no |
| Serratus Stretch Breathing | `mdfit/videos/exercise-library/Rehab/Shoulders/Mobility/serratus-stretch-breathing` | kind: Rehab · region: Shoulders · category: Mobility · library category: Stretching · level: 2 · location: Anywhere · joint: Shoulders · muscle: Upper back & spine · seated: no · pain tracks: Serratus anterior → side ribs & shoulder blade · file code: SH_BR_SERRATUS_BREATHING_STRETCH_MOB |
| Shoulder Drop Hold | `mdfit/videos/exercise-library/Rehab/Shoulders/Rehab/shoulder-drop-hold` | kind: Rehab · region: Shoulders · category: Rehab · library category: Rehabilitation · level: 2 · location: Anywhere · joint: Shoulders · muscle: Shoulders (delts & cuff) · seated: no · pain tracks: Scalenes → front of the chest; Pec major → chest & front of shoulder; Scalenes → neck, shoulder blade & deltoid; Supraspinatus → top & outside of the shoulder; Anterior deltoid → front of the shoulder; Levator scapulae → upper shoulder blade · file code: SH_SC_SHOULDER_DROP_HOLD_RHB |
| Strict Dip | `mdfit/videos/exercise-library/Exercise/Shoulders/Strength/strict-dip` | kind: Exercise · region: Shoulders · category: Strength · library category: Strength training · level: 5 · location: Gym · joint: Shoulders · muscle: Triceps · seated: no |
| Strict Handstand Push Up | `mdfit/videos/exercise-library/Exercise/Shoulders/Strength/strict-handstand-push-up` | kind: Exercise · region: Shoulders · category: Strength · library category: Strength training · level: 9 · location: Home · joint: Shoulders · muscle: Shoulders (delts & cuff) · seated: no |
| Strict Press | `mdfit/videos/exercise-library/Exercise/Shoulders/Strength/strict-press` | kind: Exercise · region: Shoulders · category: Strength · library category: Strength training · level: 2 · location: Gym · joint: Shoulders · muscle: Shoulders (delts & cuff) · seated: no |
| Wall Push Up | `mdfit/videos/exercise-library/Exercise/Shoulders/Strength/wall-push-up` | kind: Exercise · region: Shoulders · category: Strength · library category: Strength training · level: 1 · location: Home · joint: Shoulders · muscle: Chest · seated: no |
| Baseball Cable Stretch | `mdfit/videos/exercise-library/Rehab/Spine/Mobility/baseball-cable-stretch` | kind: Rehab · region: Spine · category: Mobility · library category: Stretching · level: 2 · location: Anywhere · joint: Spine & back · muscle: Full body · seated: no · pain tracks: Groin → adductor / rotational referral; Pectineus → front of groin & upper inner thigh; External oblique → abdominal wall · file code: SP_RT_BASEBALL_CABLE_STRETCH_MOB |
| Bear Crawl | `mdfit/videos/exercise-library/Exercise/Spine/Activation/bear-crawl` | kind: Exercise · region: Spine · category: Activation · library category: Specialty movements · level: 6 · location: Home · joint: Spine & back · muscle: Core & abs · seated: no |
| Cat Cow Desk Variation | `mdfit/videos/exercise-library/Rehab/Spine/Mobility/cat-cow-desk-variation` | kind: Rehab · region: Spine · category: Mobility · library category: Mobility · level: 2 · location: Anywhere · joint: Spine & back · muscle: Upper back & spine · seated: yes |
| Farmer Carry | `mdfit/videos/exercise-library/Exercise/Spine/Activation/farmer-carry` | kind: Exercise · region: Spine · category: Activation · library category: Specialty movements · level: 3 · location: Gym · joint: Spine & back · muscle: Forearms & grip · seated: no · pain tracks: Scalenes → front of the chest; Pec major → chest & front of shoulder; Pec minor / third rib → upper chest & front of shoulder; Scalenes → neck, shoulder blade & deltoid; Supraspinatus → top & outside of the shoulder; Subscapularis → front of shoulder & deep cuff · file code: SP_CR_FARMER_CARRY_ACT |
| GHD Sit Up | `mdfit/videos/exercise-library/Exercise/Spine/Mobility/ghd-sit-up` | kind: Exercise · region: Spine · category: Mobility · library category: Specialty movements · level: 6 · location: Gym · joint: Spine & back · muscle: Core & abs · seated: no · pain tracks: Iliacus → front of hip & pelvis; Psoas → front of hip & deep low back; Quadratus lumborum → low back & back of pelvis; General hip pain (front, side or back); Pectineus → front of groin & upper inner thigh · file code: SP_CO_GHD_SIT_UP_MOB |
| Lying Open Book | `mdfit/videos/exercise-library/Rehab/Spine/Mobility/lying-open-book` | kind: Rehab · region: Spine · category: Mobility · library category: Stretching · level: 2 · location: Anywhere · joint: Spine & back · muscle: Upper back & spine · seated: no |
| Pike Bear Walk | `mdfit/videos/exercise-library/Exercise/Spine/Mobility/pike-bear-walk` | kind: Exercise · region: Spine · category: Mobility · library category: Specialty movements · level: 6 · location: Home · joint: Spine & back · muscle: Core & abs · seated: no |
| Pike Forward Fold | `mdfit/videos/exercise-library/Rehab/Spine/Mobility/pike-forward-fold` | kind: Rehab · region: Spine · category: Mobility · library category: Stretching · level: 2 · location: Anywhere · joint: Spine & back · muscle: Upper back & spine · seated: no · pain tracks: Serratus anterior → side ribs & shoulder blade · file code: SP_CO_PIKE_OPEN_FORWARD_MOB |
| Quadruped T-Spine Rotation | `mdfit/videos/exercise-library/Rehab/Spine/Mobility/quadruped-t-spine-rotation` | kind: Rehab · region: Spine · category: Mobility · library category: Mobility · level: 2 · location: Anywhere · joint: Spine & back · muscle: Upper back & spine · seated: no · pain tracks: Serratus anterior → side ribs & shoulder blade; Quadratus lumborum → low back & back of pelvis; Groin → adductor / rotational referral; Pectineus → front of groin & upper inner thigh; External oblique → abdominal wall · file code: SP_RT_QUADRUPED_TSPINE_ROTATION_MOB |
| Seated Mobility Flow Beginner | `mdfit/videos/exercise-library/Rehab/Spine/Mobility/seated-mobility-flow-beginner` | kind: Rehab · region: Spine · category: Mobility · library category: Mobility · level: 2 · location: Anywhere · joint: Spine & back · muscle: Upper back & spine · seated: yes |
| Seated Mobility Flow Intermediate | `mdfit/videos/exercise-library/Rehab/Spine/Mobility/seated-mobility-flow-intermediate` | kind: Rehab · region: Spine · category: Mobility · library category: Mobility · level: 2 · location: Anywhere · joint: Spine & back · muscle: Upper back & spine · seated: yes |
| Sit Turn Lean | `mdfit/videos/exercise-library/Rehab/Spine/Mobility/sit-turn-lean` | kind: Rehab · region: Spine · category: Mobility · library category: Mobility · level: 2 · location: Anywhere · joint: Spine & back · muscle: Upper back & spine · seated: no |
| Thoracic Extension Over Chair | `mdfit/videos/exercise-library/Rehab/Spine/Mobility/thoracic-extension-over-chair` | kind: Rehab · region: Spine · category: Mobility · library category: Mobility · level: 2 · location: Anywhere · joint: Spine & back · muscle: Upper back & spine · seated: no |
| Thoracic Open Book | `mdfit/videos/exercise-library/Rehab/Spine/Mobility/thoracic-open-book` | kind: Rehab · region: Spine · category: Mobility · library category: Stretching · level: 2 · location: Anywhere · joint: Spine & back · muscle: Upper back & spine · seated: no · pain tracks: Serratus anterior → side ribs & shoulder blade; Quadratus lumborum → low back & back of pelvis; Groin → adductor / rotational referral; Pectineus → front of groin & upper inner thigh; External oblique → abdominal wall · file code: SP_RT_THORACIC_OPEN_BOOK_MOB |
| Thoracic Rotation Seated | `mdfit/videos/exercise-library/Rehab/Spine/Mobility/thoracic-rotation-seated` | kind: Rehab · region: Spine · category: Mobility · library category: Mobility · level: 2 · location: Anywhere · joint: Spine & back · muscle: Upper back & spine · seated: yes |
| Thread The Needle | `mdfit/videos/exercise-library/Rehab/Spine/Mobility/thread-the-needle` | kind: Rehab · region: Spine · category: Mobility · library category: Stretching · level: 2 · location: Anywhere · joint: Spine & back · muscle: Upper back & spine · seated: no · pain tracks: Serratus anterior → side ribs & shoulder blade; Quadratus lumborum → low back & back of pelvis; Groin → adductor / rotational referral; Pectineus → front of groin & upper inner thigh; External oblique → abdominal wall · file code: SP_RT_THREAD_THE_NEEDLE_MOB |
| Walk Out | `mdfit/videos/exercise-library/Exercise/Spine/Mobility/walk-out` | kind: Exercise · region: Spine · category: Mobility · library category: Specialty movements · level: 5 · location: Home · joint: Spine & back · muscle: Full body · seated: no |
| Wall Ball Sit Up | `mdfit/videos/exercise-library/Exercise/Spine/Mobility/wall-ball-sit-up` | kind: Exercise · region: Spine · category: Mobility · library category: Specialty movements · level: 8 · location: Gym · joint: Spine & back · muscle: Core & abs · seated: no |
| Cable Fly | `mdfit/videos/exercise-library/Exercise/Upper-body/Strength/cable-fly` | kind: Exercise · region: Upper body · category: Strength · library category: Strength training · level: 4 · location: Gym · joint: Shoulders · muscle: Chest · seated: no |
| Curl To Press | `mdfit/videos/exercise-library/Exercise/Upper-body/Strength/curl-to-press` | kind: Exercise · region: Upper body · category: Strength · library category: Strength training · level: 3 · location: Gym · joint: Elbows · muscle: Biceps · seated: no |
| Eccentric Wrist Drops | `mdfit/videos/exercise-library/Rehab/Wrists/Rehab/eccentric-wrist-drops` | kind: Rehab · region: Wrists · category: Rehab · library category: Rehabilitation · level: 2 · location: Anywhere · joint: Wrists & hands · muscle: Forearms & grip · seated: no · pain tracks: Extensor carpi radialis → outer forearm & elbow; General radialis (brachioradialis) → forearm & thumb side · file code: WR_CO_ECCENTRIC_WRIST_DROPS_RHB |
| Eccentric Wrist Pronator | `mdfit/videos/exercise-library/Rehab/Wrists/Rehab/eccentric-wrist-pronator` | kind: Rehab · region: Wrists · category: Rehab · library category: Rehabilitation · level: 2 · location: Anywhere · joint: Wrists & hands · muscle: Forearms & grip · seated: no |
| Weighted Wrist Circles | `mdfit/videos/exercise-library/Rehab/Wrists/Activation/weighted-wrist-circles` | kind: Rehab · region: Wrists · category: Activation · library category: Rehabilitation · level: 2 · location: Anywhere · joint: Wrists & hands · muscle: Forearms & grip · seated: no · pain tracks: Extensor carpi radialis → outer forearm & elbow; General radialis (brachioradialis) → forearm & thumb side · file code: WR_RT_WEIGHTED_WRIST_CIRCLES_ACT |

### Pain-track videos (3)

| Display name | Cloudinary path | Details |
|---|---|---|
| Scalene Release (Scalenes → front of the chest, Level 1) | `mdfit/videos/pain-tracks/Chest/scalenes-to-front-of-the-chest/level-1-01-scalene-release` | pain track: Scalenes → front of the chest · region: Chest · level: 1 · stage: Tissue release & mobility · order: 1 · file code: NK_MOB_SCALENE_RELEASE_RHB · pain tracks: Pec major → chest & front of shoulder; Scalenes → neck, shoulder blade & deltoid; Supraspinatus → top & outside of the shoulder; Subscapularis → front of shoulder & deep cuff; Anterior deltoid → front of the shoulder; Levator scapulae → upper shoulder blade; Infraspinatus → back & deep front of the shoulder |
| Eccentric Dumbbell Shrug Drop (Scalenes → front of the chest, Level 3) | `mdfit/videos/pain-tracks/Chest/scalenes-to-front-of-the-chest/level-3-01-eccentric-dumbbell-shrug-drop` | pain track: Scalenes → front of the chest · region: Chest · level: 3 · stage: Loaded eccentric integration · order: 1 · file code: CO_CO_BIRD_DOG_STR · pain tracks: Pec minor / third rib → upper chest & front of shoulder; Subscapularis → front of shoulder & deep cuff; Subscapularis → front of shoulder & deep cuff; Subscapularis → front of shoulder & deep cuff; Subscapularis → front of shoulder & deep cuff; Anterior deltoid → front of the shoulder; Levator scapulae → upper shoulder blade; Infraspinatus → back & deep front of the shoulder; Triceps → back of the arm; Triceps → back of the arm; Serratus anterior → side ribs & shoulder blade; Extensor carpi radialis → outer forearm & elbow; Pronator / medial forearm → inner forearm & elbow; General radialis (brachioradialis) → forearm & thumb side; Foot → sole, heel & arch; Foot → sole, heel & arch; Calf / soleus → calf, heel & plantar complex; Calf / soleus → calf, heel & plantar complex; Calf / soleus → calf, heel & plantar complex; Iliacus → front of hip & pelvis; Iliacus → front of hip & pelvis; Psoas → front of hip & deep low back; Psoas → front of hip & deep low back; Quadratus lumborum → low back & back of pelvis |
| Scalene Stretch (Scalenes → neck, shoulder blade & deltoid, Level 1) | `mdfit/videos/pain-tracks/Neck-and-shoulder/scalenes-to-neck-shoulder-blade-and-deltoid/level-1-02-scalene-stretch` | pain track: Scalenes → neck, shoulder blade & deltoid · region: Neck & shoulder · level: 1 · stage: Stage 1 · Tissue release & mobility · order: 2 · file code: NK_MOB_SCALENE_STRETCH_RHB · pain tracks: Supraspinatus → top & outside of the shoulder; Subscapularis → front of shoulder & deep cuff; Anterior deltoid → front of the shoulder; Levator scapulae → upper shoulder blade; Infraspinatus → back & deep front of the shoulder |

### App intro videos (3)

| Display name | Cloudinary path | Details |
|---|---|---|
| Library intro | `mdfit/videos/app-intros/library-intro` | screen: library |
| Generator intro | `mdfit/videos/app-intros/generator-intro` | screen: generator |
| Pain intro | `mdfit/videos/app-intros/pain-intro` | screen: pain |

### Lectures (2)

| Display name | Cloudinary path | Details |
|---|---|---|
| Hormones, anti-cortisol & longevity | `mdfit/videos/lectures/hormones-anti-cortisol-and-longevity` | minutes: 58 · topic: Hormones |
| The cortisol program | `mdfit/videos/lectures/the-cortisol-program` | minutes: 40 · topic: Hormones |

### Pain-pattern images (28)

| Display name | Cloudinary path | Details |
|---|---|---|
| Scalenes → front of the chest: pain pattern 1 | `mdfit/images/pain-patterns/Chest/scalenes-to-front-of-the-chest/pattern-1` | pain track: Scalenes → front of the chest · region: Chest |
| Pec major → chest & front of shoulder: pain pattern 1 | `mdfit/images/pain-patterns/Chest/pec-major-to-chest-and-front-of-shoulder/pattern-1` | pain track: Pec major → chest & front of shoulder · region: Chest |
| Pec major → chest & front of shoulder: pain pattern 2 | `mdfit/images/pain-patterns/Chest/pec-major-to-chest-and-front-of-shoulder/pattern-2` | pain track: Pec major → chest & front of shoulder · region: Chest |
| Pec minor / third rib → upper chest & front of shoulder: pain pattern 1 | `mdfit/images/pain-patterns/Chest/pec-minor-third-rib-to-upper-chest-and-front-of-shoulder/pattern-1` | pain track: Pec minor / third rib → upper chest & front of shoulder · region: Chest |
| Pec minor / third rib → upper chest & front of shoulder: pain pattern 2 | `mdfit/images/pain-patterns/Chest/pec-minor-third-rib-to-upper-chest-and-front-of-shoulder/pattern-2` | pain track: Pec minor / third rib → upper chest & front of shoulder · region: Chest |
| Scalenes → neck, shoulder blade & deltoid: pain pattern 1 | `mdfit/images/pain-patterns/Neck-and-shoulder/scalenes-to-neck-shoulder-blade-and-deltoid/pattern-1` | pain track: Scalenes → neck, shoulder blade & deltoid · region: Neck & shoulder |
| Supraspinatus → top & outside of the shoulder: pain pattern 1 | `mdfit/images/pain-patterns/Shoulder/supraspinatus-to-top-and-outside-of-the-shoulder/pattern-1` | pain track: Supraspinatus → top & outside of the shoulder · region: Shoulder |
| Subscapularis → front of shoulder & deep cuff: pain pattern 1 | `mdfit/images/pain-patterns/Shoulder/subscapularis-to-front-of-shoulder-and-deep-cuff/pattern-1` | pain track: Subscapularis → front of shoulder & deep cuff · region: Shoulder |
| Anterior deltoid → front of the shoulder: pain pattern 1 | `mdfit/images/pain-patterns/Shoulder/anterior-deltoid-to-front-of-the-shoulder/pattern-1` | pain track: Anterior deltoid → front of the shoulder · region: Shoulder |
| Levator scapulae → upper shoulder blade: pain pattern 1 | `mdfit/images/pain-patterns/Neck-and-shoulder/levator-scapulae-to-upper-shoulder-blade/pattern-1` | pain track: Levator scapulae → upper shoulder blade · region: Neck & shoulder |
| Infraspinatus → back & deep front of the shoulder: pain pattern 1 | `mdfit/images/pain-patterns/Shoulder/infraspinatus-to-back-and-deep-front-of-the-shoulder/pattern-1` | pain track: Infraspinatus → back & deep front of the shoulder · region: Shoulder |
| Triceps → back of the arm: pain pattern 1 | `mdfit/images/pain-patterns/Upper-arm/triceps-to-back-of-the-arm/pattern-1` | pain track: Triceps → back of the arm · region: Upper arm |
| Serratus anterior → side ribs & shoulder blade: pain pattern 1 | `mdfit/images/pain-patterns/Ribs/serratus-anterior-to-side-ribs-and-shoulder-blade/pattern-1` | pain track: Serratus anterior → side ribs & shoulder blade · region: Ribs |
| Extensor carpi radialis → outer forearm & elbow: pain pattern 1 | `mdfit/images/pain-patterns/Forearm/extensor-carpi-radialis-to-outer-forearm-and-elbow/pattern-1` | pain track: Extensor carpi radialis → outer forearm & elbow · region: Forearm |
| Pronator / medial forearm → inner forearm & elbow: pain pattern 1 | `mdfit/images/pain-patterns/Forearm/pronator-medial-forearm-to-inner-forearm-and-elbow/pattern-1` | pain track: Pronator / medial forearm → inner forearm & elbow · region: Forearm |
| General radialis (brachioradialis) → forearm & thumb side: pain pattern 1 | `mdfit/images/pain-patterns/Forearm/general-radialis-brachioradialis-to-forearm-and-thumb-side/pattern-1` | pain track: General radialis (brachioradialis) → forearm & thumb side · region: Forearm |
| Foot → sole, heel & arch: pain pattern 1 | `mdfit/images/pain-patterns/Foot/foot-to-sole-heel-and-arch/pattern-1` | pain track: Foot → sole, heel & arch · region: Foot |
| Calf / soleus → calf, heel & plantar complex: pain pattern 1 | `mdfit/images/pain-patterns/Calf/calf-soleus-to-calf-heel-and-plantar-complex/pattern-1` | pain track: Calf / soleus → calf, heel & plantar complex · region: Calf |
| Iliacus → front of hip & pelvis: pain pattern 1 | `mdfit/images/pain-patterns/Hip-and-groin/iliacus-to-front-of-hip-and-pelvis/pattern-1` | pain track: Iliacus → front of hip & pelvis · region: Hip & groin |
| Psoas → front of hip & deep low back: pain pattern 1 | `mdfit/images/pain-patterns/Low-back-and-hip/psoas-to-front-of-hip-and-deep-low-back/pattern-1` | pain track: Psoas → front of hip & deep low back · region: Low back & hip |
| Quadratus lumborum → low back & back of pelvis: pain pattern 1 | `mdfit/images/pain-patterns/Low-back/quadratus-lumborum-to-low-back-and-back-of-pelvis/pattern-1` | pain track: Quadratus lumborum → low back & back of pelvis · region: Low back |
| General hip pain (front, side or back): pain pattern 1 | `mdfit/images/pain-patterns/Hip/general-hip-pain-front-side-or-back/pattern-1` | pain track: General hip pain (front, side or back) · region: Hip |
| Gluteus maximus → back of hip & sacrum: pain pattern 1 | `mdfit/images/pain-patterns/Glutes/gluteus-maximus-to-back-of-hip-and-sacrum/pattern-1` | pain track: Gluteus maximus → back of hip & sacrum · region: Glutes |
| Gluteus minimus → side of hip & SI region: pain pattern 1 | `mdfit/images/pain-patterns/Glutes/gluteus-minimus-to-side-of-hip-and-si-region/pattern-1` | pain track: Gluteus minimus → side of hip & SI region · region: Glutes |
| Groin → adductor / rotational referral: pain pattern 1 | `mdfit/images/pain-patterns/Hip-and-groin/groin-to-adductor-rotational-referral/pattern-1` | pain track: Groin → adductor / rotational referral · region: Hip & groin |
| Pectineus → front of groin & upper inner thigh: pain pattern 1 | `mdfit/images/pain-patterns/Hip-and-groin/pectineus-to-front-of-groin-and-upper-inner-thigh/pattern-1` | pain track: Pectineus → front of groin & upper inner thigh · region: Hip & groin |
| External oblique → abdominal wall: pain pattern 1 | `mdfit/images/pain-patterns/Abdomen/external-oblique-to-abdominal-wall/pattern-1` | pain track: External oblique → abdominal wall · region: Abdomen |
| Knee → referred knee pain: pain pattern 1 | `mdfit/images/pain-patterns/Knee/knee-to-referred-knee-pain/pattern-1` | pain track: Knee → referred knee pain · region: Knee |

### Protocol sheets (8)

| Display name | Cloudinary path | Details |
|---|---|---|
| Golfer's elbow protocol: week 1 | `mdfit/images/protocols/golfers-elbow/week-1` | protocol: Golfer's elbow · week: 1 |
| Golfer's elbow protocol: week 2 | `mdfit/images/protocols/golfers-elbow/week-2` | protocol: Golfer's elbow · week: 2 |
| Golfer's elbow protocol: week 3 | `mdfit/images/protocols/golfers-elbow/week-3` | protocol: Golfer's elbow · week: 3 |
| Golfer's elbow protocol: week 4 | `mdfit/images/protocols/golfers-elbow/week-4` | protocol: Golfer's elbow · week: 4 |
| Tennis elbow protocol: week 1 | `mdfit/images/protocols/tennis-elbow/week-1` | protocol: Tennis elbow · week: 1 |
| Tennis elbow protocol: week 2 | `mdfit/images/protocols/tennis-elbow/week-2` | protocol: Tennis elbow · week: 2 |
| Tennis elbow protocol: week 3 | `mdfit/images/protocols/tennis-elbow/week-3` | protocol: Tennis elbow · week: 3 |
| Tennis elbow protocol: week 4 | `mdfit/images/protocols/tennis-elbow/week-4` | protocol: Tennis elbow · week: 4 |

### Guide images (21)

| Display name | Cloudinary path | Details |
|---|---|---|
| calf anatomy | `mdfit/images/guides/calf/calf-anatomy` | source path: /assets/guides/calf-anatomy.webp · guide: calf · view: anatomy |
| calf referral | `mdfit/images/guides/calf/calf-referral` | source path: /assets/guides/calf-referral.webp · guide: calf · view: referral |
| calf thumb | `mdfit/images/guides/calf/calf-thumb` | source path: /assets/guides/calf-thumb.webp · guide: calf · view: thumb |
| iliopsoas anatomy | `mdfit/images/guides/iliopsoas/iliopsoas-anatomy` | source path: /assets/guides/iliopsoas-anatomy.webp · guide: iliopsoas · view: anatomy |
| iliopsoas referral | `mdfit/images/guides/iliopsoas/iliopsoas-referral` | source path: /assets/guides/iliopsoas-referral.webp · guide: iliopsoas · view: referral |
| iliopsoas thumb | `mdfit/images/guides/iliopsoas/iliopsoas-thumb` | source path: /assets/guides/iliopsoas-thumb.webp · guide: iliopsoas · view: thumb |
| lateral hip anatomy | `mdfit/images/guides/lateral-hip/lateral-hip-anatomy` | source path: /assets/guides/lateral-hip-anatomy.webp · guide: lateral-hip · view: anatomy |
| lateral hip referral | `mdfit/images/guides/lateral-hip/lateral-hip-referral` | source path: /assets/guides/lateral-hip-referral.webp · guide: lateral-hip · view: referral |
| lateral hip thumb | `mdfit/images/guides/lateral-hip/lateral-hip-thumb` | source path: /assets/guides/lateral-hip-thumb.webp · guide: lateral-hip · view: thumb |
| posterior neck anatomy | `mdfit/images/guides/posterior-neck/posterior-neck-anatomy` | source path: /assets/guides/posterior-neck-anatomy.webp · guide: posterior-neck · view: anatomy |
| posterior neck referral | `mdfit/images/guides/posterior-neck/posterior-neck-referral` | source path: /assets/guides/posterior-neck-referral.webp · guide: posterior-neck · view: referral |
| posterior neck thumb | `mdfit/images/guides/posterior-neck/posterior-neck-thumb` | source path: /assets/guides/posterior-neck-thumb.webp · guide: posterior-neck · view: thumb |
| quads anatomy | `mdfit/images/guides/quads/quads-anatomy` | source path: /assets/guides/quads-anatomy.webp · guide: quads · view: anatomy |
| quads referral | `mdfit/images/guides/quads/quads-referral` | source path: /assets/guides/quads-referral.webp · guide: quads · view: referral |
| quads thumb | `mdfit/images/guides/quads/quads-thumb` | source path: /assets/guides/quads-thumb.webp · guide: quads · view: thumb |
| rotator cuff anatomy | `mdfit/images/guides/rotator-cuff/rotator-cuff-anatomy` | source path: /assets/guides/rotator-cuff-anatomy.webp · guide: rotator-cuff · view: anatomy |
| rotator cuff referral | `mdfit/images/guides/rotator-cuff/rotator-cuff-referral` | source path: /assets/guides/rotator-cuff-referral.webp · guide: rotator-cuff · view: referral |
| rotator cuff thumb | `mdfit/images/guides/rotator-cuff/rotator-cuff-thumb` | source path: /assets/guides/rotator-cuff-thumb.webp · guide: rotator-cuff · view: thumb |
| scalenes anatomy | `mdfit/images/guides/scalenes/scalenes-anatomy` | source path: /assets/guides/scalenes-anatomy.webp · guide: scalenes · view: anatomy |
| scalenes referral | `mdfit/images/guides/scalenes/scalenes-referral` | source path: /assets/guides/scalenes-referral.webp · guide: scalenes · view: referral |
| scalenes thumb | `mdfit/images/guides/scalenes/scalenes-thumb` | source path: /assets/guides/scalenes-thumb.webp · guide: scalenes · view: thumb |

### Pain-map images (28)

| Display name | Cloudinary path | Details |
|---|---|---|
| body figures 760 | `mdfit/images/pain-map/body-figures-760` | source path: /assets/pain/body-figures-760.webp |
| body figures gray | `mdfit/images/pain-map/body-figures-gray` | source path: /assets/pain/body-figures-gray.webp |
| body figures | `mdfit/images/pain-map/body-figures` | source path: /assets/pain/body-figures.webp |
| body mask | `mdfit/images/pain-map/body-mask` | source path: /assets/pain/body-mask.png |
| body figures clean | `mdfit/images/pain-map/clean-sources/body-figures-clean` | source path: /assets/pain/clean/body-figures-clean.png |
| calf anatomy | `mdfit/images/pain-map/clean-sources/calf-anatomy` | source path: /assets/pain/clean/calf-anatomy.png |
| calf pain | `mdfit/images/pain-map/clean-sources/calf-pain` | source path: /assets/pain/clean/calf-pain.png |
| guide calf clean | `mdfit/images/pain-map/clean-sources/guide-calf-clean` | source path: /assets/pain/clean/guide-calf-clean.png |
| guide iliopsoas clean | `mdfit/images/pain-map/clean-sources/guide-iliopsoas-clean` | source path: /assets/pain/clean/guide-iliopsoas-clean.png |
| guide lateral hip clean | `mdfit/images/pain-map/clean-sources/guide-lateral-hip-clean` | source path: /assets/pain/clean/guide-lateral-hip-clean.png |
| guide posterior neck clean | `mdfit/images/pain-map/clean-sources/guide-posterior-neck-clean` | source path: /assets/pain/clean/guide-posterior-neck-clean.png |
| guide quads clean | `mdfit/images/pain-map/clean-sources/guide-quads-clean` | source path: /assets/pain/clean/guide-quads-clean.png |
| guide rotator cuff clean | `mdfit/images/pain-map/clean-sources/guide-rotator-cuff-clean` | source path: /assets/pain/clean/guide-rotator-cuff-clean.png |
| guide scalenes clean | `mdfit/images/pain-map/clean-sources/guide-scalenes-clean` | source path: /assets/pain/clean/guide-scalenes-clean.png |
| iliopsoas anatomy | `mdfit/images/pain-map/clean-sources/iliopsoas-anatomy` | source path: /assets/pain/clean/iliopsoas-anatomy.png |
| iliopsoas pain | `mdfit/images/pain-map/clean-sources/iliopsoas-pain` | source path: /assets/pain/clean/iliopsoas-pain.png |
| lateral hip anatomy | `mdfit/images/pain-map/clean-sources/lateral-hip-anatomy` | source path: /assets/pain/clean/lateral-hip-anatomy.png |
| lateral hip pain | `mdfit/images/pain-map/clean-sources/lateral-hip-pain` | source path: /assets/pain/clean/lateral-hip-pain.png |
| posterior neck anatomy | `mdfit/images/pain-map/clean-sources/posterior-neck-anatomy` | source path: /assets/pain/clean/posterior-neck-anatomy.png |
| posterior neck pain | `mdfit/images/pain-map/clean-sources/posterior-neck-pain` | source path: /assets/pain/clean/posterior-neck-pain.png |
| quads anatomy | `mdfit/images/pain-map/clean-sources/quads-anatomy` | source path: /assets/pain/clean/quads-anatomy.png |
| quads pain | `mdfit/images/pain-map/clean-sources/quads-pain` | source path: /assets/pain/clean/quads-pain.png |
| rc anatomy | `mdfit/images/pain-map/clean-sources/rc-anatomy` | source path: /assets/pain/clean/rc-anatomy.png |
| rc details | `mdfit/images/pain-map/clean-sources/rc-details` | source path: /assets/pain/clean/rc-details.png |
| rc pain | `mdfit/images/pain-map/clean-sources/rc-pain` | source path: /assets/pain/clean/rc-pain.png |
| scalenes anatomy | `mdfit/images/pain-map/clean-sources/scalenes-anatomy` | source path: /assets/pain/clean/scalenes-anatomy.png |
| scalenes pain | `mdfit/images/pain-map/clean-sources/scalenes-pain` | source path: /assets/pain/clean/scalenes-pain.png |
| openstax muscles | `mdfit/images/pain-map/openstax-muscles` | source path: /assets/pain/openstax-muscles.jpg |

### Program covers (22)

| Display name | Cloudinary path | Details |
|---|---|---|
| anti inflammatory new | `mdfit/images/programs/anti-inflammatory-new` | source path: /assets/programs/anti-inflammatory-new.png · program: anti-inflammatory · version: new |
| anti inflammatory | `mdfit/images/programs/anti-inflammatory` | source path: /assets/programs/anti-inflammatory.webp · program: anti-inflammatory · version: original |
| dream lean new | `mdfit/images/programs/dream-lean-new` | source path: /assets/programs/dream-lean-new.png · program: dream-lean · version: new |
| dream lean | `mdfit/images/programs/dream-lean` | source path: /assets/programs/dream-lean.webp · program: dream-lean · version: original |
| golf new | `mdfit/images/programs/golf-new` | source path: /assets/programs/golf-new.png · program: golf · version: new |
| golf | `mdfit/images/programs/golf` | source path: /assets/programs/golf.webp · program: golf · version: original |
| hip new | `mdfit/images/programs/hip-new` | source path: /assets/programs/hip-new.png · program: hip · version: new |
| hip | `mdfit/images/programs/hip` | source path: /assets/programs/hip.webp · program: hip · version: original |
| hypertrophy new | `mdfit/images/programs/hypertrophy-new` | source path: /assets/programs/hypertrophy-new.png · program: hypertrophy · version: new |
| hypertrophy | `mdfit/images/programs/hypertrophy` | source path: /assets/programs/hypertrophy.webp · program: hypertrophy · version: original |
| low back new | `mdfit/images/programs/low-back-new` | source path: /assets/programs/low-back-new.png · program: low-back · version: new |
| low back | `mdfit/images/programs/low-back` | source path: /assets/programs/low-back.webp · program: low-back · version: original |
| marathon new | `mdfit/images/programs/marathon-new` | source path: /assets/programs/marathon-new.png · program: marathon · version: new |
| marathon | `mdfit/images/programs/marathon` | source path: /assets/programs/marathon.webp · program: marathon · version: original |
| mobility ladder new | `mdfit/images/programs/mobility-ladder-new` | source path: /assets/programs/mobility-ladder-new.png · program: mobility-ladder · version: new |
| mobility ladder | `mdfit/images/programs/mobility-ladder` | source path: /assets/programs/mobility-ladder.webp · program: mobility-ladder · version: original |
| pickleball | `mdfit/images/programs/pickleball` | source path: /assets/programs/pickleball.png · program: pickleball · version: original |
| running new | `mdfit/images/programs/running-new` | source path: /assets/programs/running-new.png · program: running · version: new |
| running | `mdfit/images/programs/running` | source path: /assets/programs/running.webp · program: running · version: original |
| shoulder new | `mdfit/images/programs/shoulder-new` | source path: /assets/programs/shoulder-new.png · program: shoulder · version: new |
| shoulder | `mdfit/images/programs/shoulder` | source path: /assets/programs/shoulder.webp · program: shoulder · version: original |
| tennis | `mdfit/images/programs/tennis` | source path: /assets/programs/tennis.webp · program: tennis · version: original |

### Branding (5)

| Display name | Cloudinary path | Details |
|---|---|---|
| app icon 192 | `mdfit/images/branding/app-icon-192` | source path: /assets/app-icon-192.png |
| app icon 512 | `mdfit/images/branding/app-icon-512` | source path: /assets/app-icon-512.png |
| dr jared | `mdfit/images/branding/dr-jared` | source path: /assets/dr-jared.jpg |
| icon 64 | `mdfit/images/branding/icon-64` | source path: /assets/icon-64.png |
| logo | `mdfit/images/branding/logo` | source path: /assets/logo.webp |


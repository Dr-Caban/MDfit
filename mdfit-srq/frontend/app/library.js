// Video library taxonomy: Dr. Jared's five categories, primary joint and primary muscle for every exercise. window.MDFitLib
(function () {
  "use strict";
  const CATEGORIES = ["Strength training", "Stretching", "Rehabilitation", "Specialty movements", "Mobility"];
  const SPECIALTY = /burpee|snatch|clean|thruster|wall ball|jump|dash|sled|bike|muscle up|handstand|turkish|crab|bear|spider|sprawl|heavy bag|slam|carry|ghd|pistol|walk out|blaster|tutorial|habit|walk break/i;
  const STRETCH = /stretch|release|child|fold|surrender|open book|thread the needle|couch|breathing|pole squat/i;
  const REHAB = /rotator cuff|eccentric|neuroglide|nods|chin glide|cars|liftoff|clamshell|reset|external rotation|internal rotation|shoulder drop|scapular|floor slide|wrist|knee circles|core brace|balance|march|heel walk|toe walk|vibration/i;
  function category(e) {
    if (e.cat === "Power" || SPECIALTY.test(e.name) || e.cat === "Lifestyle" || e.cat === "Desk & posture") return "Specialty movements";
    if (STRETCH.test(e.name)) return "Stretching";
    if (["Rehab", "Neuroglide", "Posture"].includes(e.cat) || REHAB.test(e.name)) return "Rehabilitation";
    if (e.cat === "Strength" || e.cat === "Activation" || /swing|hip thrust|split squat|trx squat|pulldown/i.test(e.name)) return "Strength training";
    return "Mobility";
  }

  const JOINTS = ["Shoulders", "Elbows", "Wrists & hands", "Neck", "Spine & back", "Core", "Hips", "Knees", "Ankles & feet", "Full body", "Desk & lifestyle"];
  const RC_JOINT = { SH: "Shoulders", EL: "Elbows", WR: "Wrists & hands", NK: "Neck", SP: "Spine & back", CO: "Core", HP: "Hips", KN: "Knees", AN: "Ankles & feet", FB: "Full body", ERG: "Desk & lifestyle" };
  function joint(e) {
    if (e.rc === "LB") return /heel|toe|calf|rope|balance|march/i.test(e.name) ? "Ankles & feet" : "Knees";
    if (e.rc === "UB") return /curl/i.test(e.name) ? "Elbows" : "Shoulders";
    return RC_JOINT[e.rc] || "Full body";
  }

  // First match wins, so the more specific muscles come first
  const MUSCLE_RULES = [
    ["Shoulders (delts & cuff)", /handstand|pike push|scap push/i], ["Upper back & spine", /breathing/i],
    ["Triceps", /tricep|\bdips?\b/i], ["Biceps", /bicep|curl/i], ["Forearms & grip", /wrist|farmer/i],
    ["Calves & feet", /calf|toe walk|heel walk|ankle|jump rope/i], ["Neck & traps", /neck|trap|scalene|scm|chin glide|cervical|levator/i],
    ["Chest", /bench|push up|fly|pec/i], ["Back & lats", /row|pulldown|pull up|\blat\b|face pull|muscle up|rack pull|floor slide|retract/i],
    ["Shoulders (delts & cuff)", /press|raise|handstand|rotator|scap|serratus|shoulder|external rotation|internal rotation|clavicle|overhead/i],
    ["Hip flexors", /couch|surrender|pillow belt|hip drop|psoas/i],
    ["Hamstrings", /rdl|romanian|deadlift|hinge|pull through|swing/i], ["Glutes", /glute|hip thrust|bridge|clamshell|abduction|hip |hip$|90\/90|cossack/i],
    ["Quads", /squat|lunge|step up|sissy|knee|split|sled|box jump|long jump/i],
    ["Core & abs", /plank|dead bug|sit up|core|bear|landmine|slam|carry|get up|crawl/i],
    ["Upper back & spine", /thoracic|t-spine|cat cow|open book|thread|spine|child|fold|breathing|sit turn|mobility flow|posture/i]
  ];
  const MUSCLES = ["Neck & traps", "Chest", "Back & lats", "Shoulders (delts & cuff)", "Biceps", "Triceps", "Forearms & grip", "Core & abs", "Upper back & spine", "Hip flexors", "Glutes", "Hamstrings", "Quads", "Calves & feet", "Full body"];
  function muscle(e) { for (const [m, re] of MUSCLE_RULES) if (re.test(e.name)) return m; return "Full body"; }

  window.MDFitLib = { CATEGORIES, JOINTS, MUSCLES, category, joint, muscle };
})();

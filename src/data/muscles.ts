// Muscle regions. Each id is the exact node name of a region in assets/models/muscles.glb.

export type MuscleId =
  | 'pec_major_upper'
  | 'pec_major_lower'
  | 'anterior_delt'
  | 'lateral_delt'
  | 'posterior_delt'
  | 'rotator_cuff'
  | 'biceps'
  | 'brachialis'
  | 'brachioradialis'
  | 'forearm_flexors'
  | 'forearm_extensors'
  | 'hand_muscles'
  | 'triceps_long'
  | 'triceps_lateral'
  | 'triceps_medial'
  | 'upper_lats'
  | 'lower_lats'
  | 'teres_major'
  | 'rhomboids'
  | 'upper_traps'
  | 'mid_traps'
  | 'lower_traps'
  | 'erector_spinae'
  | 'serratus_anterior'
  | 'neck_flexors'
  | 'neck_extensors'
  // Legs and abs
  | 'rectus_abdominis'
  | 'obliques'
  | 'transverse_abdominis'
  | 'hip_flexors'
  | 'adductors'
  | 'glute_max'
  | 'glute_med'
  | 'hip_rotators'
  | 'rectus_femoris'
  | 'vastus_group'
  | 'medial_hamstrings'
  | 'lateral_hamstrings'
  | 'gastrocnemius'
  | 'soleus'
  | 'tibialis_anterior'
  | 'fibularis'
  | 'foot_muscles'
  | 'breathing';

export const MUSCLE_LABEL: Record<MuscleId, string> = {
  pec_major_upper: 'Upper chest',
  pec_major_lower: 'Mid & lower chest',
  anterior_delt: 'Front delts',
  lateral_delt: 'Side delts',
  posterior_delt: 'Rear delts',
  rotator_cuff: 'Rotator cuff',
  biceps: 'Biceps',
  brachialis: 'Brachialis',
  brachioradialis: 'Brachioradialis',
  forearm_flexors: 'Forearm flexors',
  forearm_extensors: 'Forearm extensors',
  hand_muscles: 'Grip (hands)',
  triceps_long: 'Triceps long head',
  triceps_lateral: 'Triceps lateral head',
  triceps_medial: 'Triceps medial head',
  upper_lats: 'Upper lats',
  lower_lats: 'Lower lats',
  teres_major: 'Teres major',
  rhomboids: 'Rhomboids',
  upper_traps: 'Upper traps',
  mid_traps: 'Mid traps',
  lower_traps: 'Lower traps',
  erector_spinae: 'Lower back',
  serratus_anterior: 'Serratus',
  neck_flexors: 'Neck (front)',
  neck_extensors: 'Neck (back)',
  rectus_abdominis: 'Abs',
  obliques: 'Obliques',
  transverse_abdominis: 'Deep core',
  hip_flexors: 'Hip flexors',
  adductors: 'Adductors',
  glute_max: 'Glutes',
  glute_med: 'Side glutes',
  hip_rotators: 'Hip rotators',
  rectus_femoris: 'Quads (rectus femoris)',
  vastus_group: 'Quads',
  medial_hamstrings: 'Hamstrings (inner)',
  lateral_hamstrings: 'Hamstrings (outer)',
  gastrocnemius: 'Calves',
  soleus: 'Calves (soleus)',
  tibialis_anterior: 'Shins',
  fibularis: 'Outer shins',
  foot_muscles: 'Feet',
  breathing: 'Breathing muscles',
};

/** Model nodes that are anatomy context only (head, bones, tendons, skin), never coloured. */
export const CONTEXT_NODES = new Set(['body_context', 'context_bone', 'context_tendon', 'context_skin']);

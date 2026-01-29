
export interface User {
  displayName: string;
  membershipId: string;
  membershipType: number;
  emblemPath: string;
}

export interface Message {
  role: 'user' | 'ghost';
  text: string;
  timestamp: number;
}

export enum ConnectionStatus {
  IDLE = 'IDLE',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  ERROR = 'ERROR'
}

export interface PriorityTarget {
  id: string;
  type: 'CHAMPION' | 'ELITE' | 'BOSS' | 'HIVE_GHOST';
  subType?: 'OVERLOAD' | 'BARRIER' | 'UNSTOPPABLE';
  name: string;
  status: 'ACTIVE' | 'STUNNED' | 'VULNERABLE';
  position: { x: number; y: number; w: number; h: number };
}

export interface LowManData {
  feasibility: 'FEASIBLE' | 'EXTREME' | 'IMPOSSIBLE';
  difficultyRating: number;
  duoStrategy: string;
  bypassMechanics: string[];
  detailedBypassInstructions?: string[];
  recommendedSkills?: string[];
}

export interface StrategyGuide {
  activityName: string;
  maxCapacity: 3 | 6;
  roles: { title: string; loadout: string }[];
  mechanics: string[];
  pitfalls: string[];
  lowManData?: LowManData;
}

export interface EncounterState {
  phase: string;
  activeTip: string;
  dangerLevel: 'SAFE' | 'CAUTION' | 'CRITICAL';
  lastUpdated: number;
  targets?: PriorityTarget[];
}

// Lanpa status enum
export enum LanpaStatus {
  DRAFT = 'draft',
  VOTING_GAMES = 'voting_games',
  VOTING_ACTIVE = 'voting_active',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
}

// Member status enum
export enum MemberStatus {
  INVITED = 'invited',
  CONFIRMED = 'confirmed',
  DECLINED = 'declined',
  ATTENDED = 'attended',
}

// Rating type enum
export enum RatingType {
  ADMIN_TO_MEMBER = 'admin_to_member',
  MEMBER_TO_ADMIN = 'member_to_admin',
  MEMBER_TO_MEMBER = 'member_to_member',
}

// Punishment severity enum
export enum PunishmentSeverity {
  WARNING = 'warning',
  PENALTY = 'penalty',
  SUSPENSION = 'suspension',
}

// Punishment nomination status enum
export enum NominationStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

// Notification types
export enum NotificationType {
  LANPA_CREATED = 'lanpa_created',
  LANPA_UPDATED = 'lanpa_updated',
  LANPA_INVITATION = 'lanpa_invitation',
  GAME_VOTING_STARTED = 'game_voting_started',
  GAME_VOTING_ENDED = 'game_voting_ended',
  PUNISHMENT_NOMINATION = 'punishment_nomination',
  PUNISHMENT_VOTING_ENDED = 'punishment_voting_ended',
  LANPA_REMINDER = 'lanpa_reminder',
  RATING_RECEIVED = 'rating_received',
}

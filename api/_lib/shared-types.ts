// Shared types and enums for Vercel API Routes
// Copied from @lanpapp/shared to avoid workspace dependency issues

// ============== ENUMS ==============

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

// ============== INTERFACES ==============

// Base entity with common fields
export interface BaseEntity {
  id: string;
  created_at: string;
  updated_at?: string;
}

export interface NotificationPreferences {
  in_app: boolean;
  push: boolean;
  email: boolean;
  lanpa_created: boolean;
  lanpa_updated: boolean;
  lanpa_invitation: boolean;
  game_voting: boolean;
  punishment_nomination: boolean;
  lanpa_reminder: boolean;
}

// User entity (extends Supabase auth.users)
export interface User extends BaseEntity {
  username: string;
  display_name: string;
  avatar_url: string | null;
  locale: string;
  notification_preferences: NotificationPreferences;
}

// Lanpa (Lan Party) entity
export interface Lanpa extends BaseEntity {
  name: string;
  description: string | null;
  admin_id: string;
  status: LanpaStatus;
  scheduled_date: string | null;
  actual_date: string | null;
  is_historical: boolean;
  selected_game_id: string | null;
}

// Lanpa Member entity
export interface LanpaMember {
  id: string;
  lanpa_id: string;
  user_id: string;
  status: MemberStatus;
  joined_at: string;
  user?: User;
}

// Lanpa Invitation entity
export interface LanpaInvitation {
  id: string;
  lanpa_id: string;
  token: string;
  expires_at: string;
  max_uses: number | null;
  uses: number;
}

// Game entity
export interface Game extends BaseEntity {
  name: string;
  description: string | null;
  cover_url: string | null;
  genre: string | null;
  min_players: number | null;
  max_players: number | null;
  created_by: string;
}

// Game with stats
export interface GameWithStats extends Game {
  times_played: number;
  average_rating: number | null;
}

// Game Suggestion entity
export interface GameSuggestion {
  id: string;
  lanpa_id: string;
  game_id: string;
  suggested_by: string;
  created_at: string;
  game?: Game;
  suggested_by_user?: User;
}

// Game Vote entity
export interface GameVote {
  id: string;
  lanpa_id: string;
  game_id: string;
  user_id: string;
  created_at: string;
}

// Lanpa with relations
export interface LanpaWithRelations extends Lanpa {
  admin?: User;
  members?: LanpaMember[];
  selected_game?: Game;
  game_suggestions?: GameSuggestion[];
  game_votes?: GameVote[];
}

// Rating entity
export interface Rating {
  id: string;
  lanpa_id: string;
  from_user_id: string;
  to_user_id: string;
  rating_type: RatingType;
  score: number;
  comment: string | null;
  created_at: string;
  from_user?: User;
  to_user?: User;
}

// Lanpa Rating entity
export interface LanpaRating {
  id: string;
  lanpa_id: string;
  user_id: string;
  score: number;
  comment: string | null;
  created_at: string;
  user?: User;
}

// Punishment entity
export interface Punishment extends BaseEntity {
  name: string;
  description: string;
  severity: PunishmentSeverity;
  point_impact: number;
  created_by: string;
}

// Punishment Vote entity
export interface PunishmentVote {
  id: string;
  nomination_id: string;
  user_id: string;
  vote: boolean;
  created_at: string;
  user?: User;
}

// Punishment Nomination entity
export interface PunishmentNomination {
  id: string;
  lanpa_id: string;
  punishment_id: string;
  nominated_user_id: string;
  nominated_by: string;
  reason: string;
  status: NominationStatus;
  voting_ends_at: string;
  created_at: string;
  punishment?: Punishment;
  nominated_user?: User;
  nominated_by_user?: User;
  votes?: PunishmentVote[];
}

// User Punishment entity
export interface UserPunishment {
  id: string;
  user_id: string;
  punishment_id: string;
  lanpa_id: string | null;
  nomination_id: string | null;
  applied_at: string;
  notes: string | null;
  punishment?: Punishment;
  lanpa?: Lanpa;
}

// Notification entity
export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, unknown>;
  read: boolean;
  created_at: string;
}

// Push Subscription entity
export interface PushSubscription {
  id: string;
  user_id: string;
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  created_at: string;
}

// ============== API DTOs ==============

// Generic API response wrapper
export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Auth DTOs
export interface RegisterRequest {
  email: string;
  password: string;
  username: string;
  display_name?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  session: {
    access_token: string;
    refresh_token: string;
    expires_at: number;
  };
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  password: string;
}

// User DTOs
export interface UpdateUserRequest {
  username?: string;
  display_name?: string;
  locale?: string;
  notification_preferences?: Partial<User['notification_preferences']>;
}

export type UserResponse = User;

// Lanpa DTOs
export interface CreateLanpaRequest {
  name: string;
  description?: string;
  scheduled_date?: string;
  is_historical?: boolean;
}

export interface UpdateLanpaRequest {
  name?: string;
  description?: string;
  scheduled_date?: string;
  actual_date?: string;
}

export interface UpdateLanpaStatusRequest {
  status: LanpaStatus;
}

export interface InviteUsersRequest {
  user_ids: string[];
}

export interface CreateInviteLinkRequest {
  expires_in_hours?: number;
  max_uses?: number;
}

export interface InviteLinkResponse {
  invitation: LanpaInvitation;
  link: string;
}

export interface SuggestGameRequest {
  game_id: string;
}

export interface VoteGameRequest {
  game_id: string;
}

export interface GameVoteResult {
  game_id: string;
  game: Game;
  votes: number;
  is_winner: boolean;
}

export interface GameResultsResponse {
  results: GameVoteResult[];
  winner: Game | null;
  was_random_tiebreaker: boolean;
}

export type LanpaResponse = LanpaWithRelations;
export type LanpasResponse = PaginatedResponse<Lanpa>;

// Game DTOs
export interface CreateGameRequest {
  name: string;
  description?: string;
  cover_url?: string;
  genre?: string;
  min_players?: number;
  max_players?: number;
}

export interface UpdateGameRequest {
  name?: string;
  description?: string | null;
  cover_url?: string | null;
  genre?: string | null;
  min_players?: number | null;
  max_players?: number | null;
}

export interface GamesQueryParams {
  page?: number;
  limit?: number;
  genre?: string;
  min_players?: number;
  max_players?: number;
  search?: string;
}

export type GameResponse = GameWithStats;
export type GamesResponse = PaginatedResponse<GameWithStats>;

// Rating DTOs
export interface CreateRatingRequest {
  to_user_id: string;
  score: number;
  comment?: string;
}

export interface CreateLanpaRatingRequest {
  score: number;
  comment?: string;
}

export interface RatingsResponse {
  admin_ratings: Rating[];
  member_ratings: Rating[];
  lanpa_rating: LanpaRating | null;
  average_scores: {
    admin: number | null;
    members: number | null;
    lanpa: number | null;
  };
}

// Punishment DTOs
export interface CreatePunishmentRequest {
  name: string;
  description: string;
  severity: string;
  point_impact?: number;
}

export interface UpdatePunishmentRequest {
  name?: string;
  description?: string;
  severity?: string;
  point_impact?: number;
}

export type PunishmentResponse = Punishment;
export type PunishmentsResponse = PaginatedResponse<Punishment>;

// Nomination DTOs
export interface CreateNominationRequest {
  lanpa_id: string;
  punishment_id: string;
  nominated_user_id: string;
  reason: string;
  voting_hours?: number;
}

export interface VoteNominationRequest {
  vote: boolean;
}

export interface NominationResponse extends PunishmentNomination {
  votes_for: number;
  votes_against: number;
  total_votes: number;
}

// User Punishments DTOs
export interface UserPunishmentsResponse {
  punishments: UserPunishment[];
  total_point_impact: number;
}

// Stats DTOs
export interface GlobalStats {
  total_lanpas: number;
  total_users: number;
  total_games_played: number;
  most_frequent_admin: {
    user: User;
    lanpas_hosted: number;
  } | null;
  most_attended_member: {
    user: User;
    lanpas_attended: number;
  } | null;
  best_rated_admin: {
    user: User;
    average_rating: number;
  } | null;
  most_played_games: GameWithStats[];
  hall_of_shame: {
    user: User;
    total_punishments: number;
    total_point_impact: number;
  }[];
}

export interface LanpaStats {
  lanpa: Lanpa;
  attendance_count: number;
  average_admin_rating: number | null;
  average_member_rating: number | null;
  average_lanpa_rating: number | null;
  games_played: Game[];
  punishments_given: number;
}

export interface UserStats {
  user: User;
  lanpas_hosted: number;
  lanpas_attended: number;
  average_rating_as_admin: number | null;
  average_rating_as_member: number | null;
  favorite_games: GameWithStats[];
  punishments: UserPunishment[];
}

export interface PersonalStats {
  lanpas_created: number;
  lanpas_attended: number;
  games_played: number;
  average_rating: number | null;
  total_punishments: number;
  has_activity: boolean;
}

export interface RankingEntry {
  rank: number;
  user: User;
  score: number;
  lanpas_attended: number;
  average_rating: number | null;
}

export interface RankingsResponse {
  clean_ranking: RankingEntry[];
  adjusted_ranking: RankingEntry[];
}

// Notifications DTOs
export interface NotificationsResponse {
  notifications: Notification[];
  unread_count: number;
}

export interface SubscribePushRequest {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

// Lanpa Games DTOs
export interface LanpaGameEntry {
  game: Game;
  suggested_by: User;
  suggested_at: string;
  votes_count: number;
  is_winner: boolean;
}

export interface LanpaGamesResponse {
  lanpa_id: string;
  games: LanpaGameEntry[];
  total_games_suggested: number;
  winner: Game | null;
}

// Lanpa Punishments DTOs
export interface LanpaPunishmentEntry {
  id: string;
  user: User;
  punishment: Punishment;
  reason: string;
  applied_at: string;
  nominator?: User;
}

export interface LanpaPunishmentsResponse {
  lanpa_id: string;
  punishments: LanpaPunishmentEntry[];
  total_punishments: number;
  total_point_impact: number;
}

-- Piggy Jump high scores (dashboard integration)
create table if not exists public.game_high_scores (
  player_id text primary key,
  best_score integer not null default 0 check (best_score >= 0),
  updated_at timestamptz not null default now()
);

create index if not exists game_high_scores_best_score_idx
  on public.game_high_scores (best_score desc);

comment on table public.game_high_scores is 'Piggy Jump 리더보드 (player_id = 닉네임 또는 user slug)';

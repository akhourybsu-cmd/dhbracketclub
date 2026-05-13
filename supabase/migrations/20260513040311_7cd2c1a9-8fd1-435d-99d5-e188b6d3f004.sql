
alter table public.member_birthdays
  add constraint member_birthdays_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

alter table public.club_milestones
  add constraint club_milestones_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete set null;

alter table public.club_milestones
  add constraint club_milestones_created_by_fkey
  foreign key (created_by) references public.profiles(id) on delete cascade;

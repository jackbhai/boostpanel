-- v4d: FKs for review/alert service joins + admin timeline-note inserts (idempotent)
delete from service_alerts where service_id not in (select id from services);
delete from reviews where service_id not in (select id from services);
alter table reviews drop constraint if exists reviews_service_fk;
alter table reviews add constraint reviews_service_fk foreign key (service_id) references services(id) on delete cascade;
alter table service_alerts drop constraint if exists alerts_service_fk;
alter table service_alerts add constraint alerts_service_fk foreign key (service_id) references services(id) on delete cascade;
drop policy if exists "events admin write" on order_events;
create policy "events admin write" on order_events for insert to authenticated with check (public.is_admin());
grant insert on order_events to authenticated;

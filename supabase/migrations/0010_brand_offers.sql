-- Partner-funded offers come in two kinds: a bank funds a discount on its own cards (applied only
-- if the customer pays with that card), and a brand funds a discount on a service that uses its
-- products (applied whatever the payment method).
alter table funder_offers add column kind text not null default 'bank' check (kind in ('bank', 'brand'));
alter table funder_offers add column service_id text references services(id);
alter table funder_offers alter column card_issuer drop not null;
alter table offers add column funder_kind text;

insert into funder_offers (id, funder, card_issuer, max_funded_amount, min_ticket, valid_from, valid_to, categories, kind, service_id)
values ('loreal_spa_100', 'L''Oréal Professionnel', null, 100, 800, '2026-10-01', '2026-10-31', array['salon', 'spa'], 'brand', 'svc_spa');

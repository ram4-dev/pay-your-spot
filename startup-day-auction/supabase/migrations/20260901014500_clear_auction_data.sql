delete from public.bids;

update public.spots
set status = 'AVAILABLE',
    started_at = null,
    ends_at = null,
    reserved_at = null,
    leading_bid_id = null,
    auction_round = 0;

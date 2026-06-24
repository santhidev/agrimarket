Status: ready-for-agent

## What to build

Bounded Knapsack optimization engine — find cheapest combination of offers that meets demand quantity. Each offer selectable once, quantity ≤ offer.quantity. Sort by total price (Σ price × qty). Distance tiebreaker (Haversine 40km/h) when prices equal. Show best combination even if doesn't fulfill full demand.quantity. Exhaustive unit tests — this is a Deep Module.

## Acceptance criteria

- [ ] Algorithm: Bounded Knapsack — select offers to minimize total cost
- [ ] Each offer used at most once (bounded)
- [ ] Selected quantity ≤ offer.quantity per offer
- [ ] Sort by total price ascending
- [ ] Tiebreaker: when total prices equal, prefer closer sellers (Haversine distance from buyer to seller pickup)
- [ ] Show best combination even if total quantity < demand.quantity
- [ ] Return: ranked combinations with cost breakdown per offer
- [ ] Edge cases: 0 offers → empty list, 1 offer → single item, offers exceed demand → optimal subset
- [ ] EXHAUSTIVE unit tests: various offer combinations, price ties, distance ties, partial fulfillment, zero offers, single offer, over quantity, exact quantity match
- [ ] Performance: handle 100+ offers within reasonable time

## Blocked by

16
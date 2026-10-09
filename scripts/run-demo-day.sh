#!/bin/bash
# Runs the whole demo day through the API, for testing. Riya's payments are simulated here;
# in the real demo they go through Razorpay Checkout on the phone.
B=${1:-http://localhost:3000}; J='content-type: application/json'
p(){ curl -s -X POST "$B$1" -H "$J" -d "$2"; echo; }
p /api/demo/reset '{}'
p /api/agent/plan '{"op":"propose"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['briefing'])"
p /api/agent/plan '{"op":"edit","text":"₹200 is too much. Make it ₹100."}' | python3 -c "import sys,json;print(json.load(sys.stdin)['reply'])"
p /api/agent/plan '{"op":"edit","text":"Go ahead."}' | python3 -c "import sys,json;print(json.load(sys.stdin)['reply'])"
p /api/agent/wave '{"wave":1,"clock":"11:30"}'
p /api/chat '{"customerId":"c_riya","text":"Can I do 4 instead? Can my sister come too?"}'
for id in $(curl -s "$B/api/demo/riya-offers"); do p /api/demo/simulate-pay "{\"offerId\":\"$id\",\"variant\":\"bank\"}"; done
echo "--- jump to 1:30"
for t in 11:50 12:20 12:50; do p /api/demo/clock "{\"to\":\"$t\",\"simulate\":[\"sale\"]}"; done
p /api/demo/clock '{"to":"13:30"}'
echo "--- 2 to 6 pm"
p /api/demo/clock '{"to":"14:00","simulate":["sale","sale"]}'
p /api/demo/clock '{"to":"15:00","simulate":["walk_in"]}'
p /api/demo/clock '{"to":"15:30","simulate":["call_me","walk_in"]}'
p /api/demo/clock '{"to":"16:00","simulate":["walk_in","walk_in"]}'
p /api/demo/clock '{"to":"17:00","simulate":["walk_in","walk_in"]}'
p /api/demo/clock '{"to":"18:00","simulate":[]}'

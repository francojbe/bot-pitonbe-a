from server import calculate_quote

print("--- Testing Scalable Pricing Logic ---")

# Case 1: 4000 Cards (Should scale linearly from 1000 price)
# 1000 Cards (2 sides, polylaminate) base is roughly 51600 total. 
# 4000 should be ~ 4 * 51600 = 206400 roughly.
try:
    print("\nTest 1: 4000 Tarjetas (2 lados, polilaminado)")
    res = calculate_quote.invoke({"product_type": "tarjetas", "quantity": 4000, "sides": 2, "finish": "polilaminado"})
    print(res)
except Exception as e:
    print(f"Error Test 1: {e}")

# Case 2: 150 Cards (Should fail gracefully)
try:
    print("\nTest 2: 150 Tarjetas (Non-standard)")
    res = calculate_quote.invoke({"product_type": "tarjetas", "quantity": 150, "sides": 2, "finish": "polilaminado"})
    print(res)
except Exception as e:
    print(f"Error Test 2: {e}")

# Case 3: 1000 Cards (Standard)
try:
    print("\nTest 3: 1000 Tarjetas (Standard)")
    res = calculate_quote.invoke({"product_type": "tarjetas", "quantity": 1000, "sides": 2, "finish": "polilaminado"})
    print(res)
except Exception as e:
    print(f"Error Test 3: {e}")

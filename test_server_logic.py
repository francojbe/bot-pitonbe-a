from server import calculate_quote, register_order

print("--- TEST 1: Pricing 1000 Cards (Logic Check) ---")
try:
    # Test 1000 units (Should be ~23k-47k, NOT 16k)
    price_quote = calculate_quote.invoke({"product_type": "tarjetas", "quantity": 1000, "sides": 2, "finish": "polilaminado"})
    print(f"Quote Result: {price_quote}")
    if "$47,600" in price_quote or "$51,600" in price_quote: 
        print("✅ Correct High Price for 1000 units.")
    elif "16,000" in price_quote:
        print("❌ FAILED: Logic returned 100 unit price (16k) for 1000 units.")
    else:
        print(f"⚠️ Unclear result: {price_quote}")

except Exception as e:
    print(f"Error testing quote: {e}")

print("\n--- TEST 2: Register Order without File (Security Check) ---")
try:
    # Test Order blocking
    # lead_id is "inject_me", has_file is False
    # Description does NOT contain "diseño" (service)
    res = register_order.invoke({
        "description": "1000 Tarjetas (Cliente dice que tiene diseño)", 
        "amount": 50000, 
        "rut": "1-9", 
        "address": "X", 
        "email": "x@x.com", 
        "has_file": False,
        "lead_id": "test_lead"
    })
    print(f"Order Result: {res}")
    
    if "❌ ERROR" in res:
        print("✅ Security Check PASSED: Order blocked because has_file=False.")
    else:
        print("❌ Security Check FAILED: Order was created despite missing file.")

except Exception as e:
    print(f"Error testing order: {e}")

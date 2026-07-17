# TARGET 1: Simple Function
# Purpose: Prove standard execution, basic constraint fallback, and unexpected exception tracking.

def divide_numbers(a: int, b: int):
    # This will crash with ZeroDivisionError when b=0 (which our basic synthesizer fallback might hit)
    return a / b


# TARGET 2: Intentional Validation
# Purpose: Prove AST parser detects isinstance constraints, synthesizer respects them, and classifier flags EXPECTED_REJECTION

def process_transaction(transaction, amount):
    if not isinstance(amount, int):
        raise TypeError("amount must be an integer")
    if amount < 0:
        raise ValueError("amount cannot be negative")
    # Will crash if transaction is None
    return transaction.get('id')


# TARGET 3: Complex Nested Input
# Purpose: Prove AST parser extracts 'required_keys' constraints (e.g. key in dict) and synthesizes a structured payload that bypasses shallow validation.

def handle_user_profile(user_data):
    if 'user_id' not in user_data:
        raise ValueError("Missing user_id")
    if 'profile' not in user_data:
        raise ValueError("Missing profile")
    
    profile = user_data['profile']
    if 'age' not in profile:
        raise ValueError("Missing age")
        
    # Will crash due to missing type check on age (if we pass a string)
    years_until_retirement = 65 - profile['age']
    return years_until_retirement

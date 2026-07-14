import ast
import json
import sys

def parse_ast(source_code):
    try:
        tree = ast.parse(source_code)
        return node_to_dict(tree)
    except SyntaxError as e:
        return {"error": "SyntaxError", "message": str(e), "line": e.lineno, "offset": e.offset}

def node_to_dict(node):
    if isinstance(node, ast.AST):
        result = {"_type": type(node).__name__}
        if hasattr(node, "lineno"):
            result["lineno"] = node.lineno
        for field, value in ast.iter_fields(node):
            result[field] = node_to_dict(value)
        return result
    elif isinstance(node, list):
        return [node_to_dict(item) for item in node]
    elif isinstance(node, dict):
        return {key: node_to_dict(value) for key, value in node.items()}
    else:
        return node

if __name__ == "__main__":
    if len(sys.argv) > 1:
        with open(sys.argv[1], "r", encoding="utf-8") as f:
            source = f.read()
    else:
        source = sys.stdin.read()
    
    print(json.dumps(parse_ast(source)))

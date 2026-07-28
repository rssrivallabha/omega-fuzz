import { Buffer } from 'buffer';

export interface CorpusItem {
  name: string;
  value: any;
  strategy: string;
  category: 'xml' | 'json' | 'sql' | 'go' | 'cpp' | 'swift' | 'bytes' | 'general';
}

export class GrammarCorpora {
  static getXmlCorpus(): CorpusItem[] {
    return [
      { name: 'xml_valid', value: '<root><item id="1">test_value</item></root>', strategy: 'Grammar: Valid XML', category: 'xml' },
      { name: 'xml_malformed', value: '<root><item>unclosed tag without ending root', strategy: 'Grammar: Malformed XML', category: 'xml' },
      { name: 'xml_truncated', value: '<root><item id="42"', strategy: 'Grammar: Truncated XML', category: 'xml' },
      { name: 'xml_deep_nesting', value: '<node id="1">'.repeat(120) + 'deep_content' + '</node>'.repeat(120), strategy: 'Grammar: Deep Nesting XML', category: 'xml' },
      { name: 'xml_huge_attrib', value: `<root><element attribute="${'A'.repeat(5000)}">content</element></root>`, strategy: 'Grammar: Huge Attribute XML', category: 'xml' },
      { name: 'xml_cdata', value: '<root><![CDATA[<script>alert("xss")</script> && <<broken xml>> in cdata]]></root>', strategy: 'Grammar: CDATA Injection', category: 'xml' },
      { name: 'xml_doctype_xxe', value: '<?xml version="1.0"?><!DOCTYPE lolz [<!ENTITY lol "lol">]> <root>&lol;&lol;&lol;</root>', strategy: 'Grammar: DOCTYPE / Entity Expansion', category: 'xml' },
      { name: 'xml_namespaces', value: '<root xmlns:foo="http://example.com/foo" xmlns:bar="http://example.com/bar"><foo:item bar:attr="val">content</foo:item></root>', strategy: 'Grammar: Namespace Collision', category: 'xml' },
      { name: 'xml_invalid_utf8_bytes', value: { __omega_bytes_hex: '3c726f6f743e696e76616c696420fffffe00757466383c2f726f6f743e' }, strategy: 'Binary: Invalid UTF-8 XML Bytes', category: 'bytes' },
      { name: 'xml_random_binary', value: { __omega_bytes_hex: '0001020304fffe7f8090a0c0e0f0' }, strategy: 'Binary: Raw Random Bytes', category: 'bytes' },
      { name: 'xml_empty', value: '', strategy: 'Boundary: Empty String', category: 'xml' },
      { name: 'xml_empty_bytes', value: { __omega_bytes_hex: '' }, strategy: 'Boundary: Empty Bytes', category: 'bytes' }
    ];
  }

  static getJsonCorpus(): CorpusItem[] {
    return [
      { name: 'json_nested_obj', value: '{"a":{"b":{"c":{"d":{"e":{"f":{"g":{"h":1}}}}}}}}', strategy: 'Grammar: Deeply Nested JSON Object', category: 'json' },
      { name: 'json_nested_arr', value: '[[[[[[[[[[["depth_11_array"]]]]]]]]]]]', strategy: 'Grammar: Deeply Nested JSON Array', category: 'json' },
      { name: 'json_duplicate_keys', value: '{"duplicate": 1, "duplicate": 2, "duplicate": "overridden_value"}', strategy: 'Grammar: Duplicate JSON Keys', category: 'json' },
      { name: 'json_trailing_comma', value: '{"name": "test", "items": [1, 2, 3, ], }', strategy: 'Grammar: Trailing Comma Syntax Error', category: 'json' },
      { name: 'json_nan_infinity', value: '{"val": NaN, "pos": Infinity, "neg": -Infinity}', strategy: 'Grammar: NaN & Infinity Literals', category: 'json' },
      { name: 'json_invalid_utf8', value: '{"surrogate": "\\uD800\\uDC00", "orphan": "\\uD800"}', strategy: 'Grammar: Orphan Surrogate / Unicode Exception', category: 'json' },
      { name: 'json_truncated', value: '{"user": {"id": 101, "name": "trunca', strategy: 'Grammar: Truncated JSON Payload', category: 'json' },
      { name: 'json_huge_payload', value: JSON.stringify({ items: new Array(1500).fill('large_string_payload_record') }), strategy: 'Grammar: Huge JSON Array', category: 'json' }
    ];
  }

  static getSqlCorpus(): CorpusItem[] {
    return [
      { name: 'sql_union_inject', value: "' UNION SELECT 1,2,3,4,5 --", strategy: 'SQLi: UNION SELECT Injection', category: 'sql' },
      { name: 'sql_boolean_blind', value: "' OR '1'='1", strategy: 'SQLi: Boolean Blind OR Injection', category: 'sql' },
      { name: 'sql_escaping', value: "\\' OR 1=1; --\\' \"\" ''", strategy: 'SQLi: String Escaping & Quotes', category: 'sql' },
      { name: 'sql_nested_query', value: "SELECT * FROM (SELECT id, username FROM users WHERE status = (SELECT MAX(status) FROM roles))", strategy: 'SQL: Deeply Nested Subqueries', category: 'sql' },
      { name: 'sql_reserved_words', value: "SELECT SELECT, TABLE FROM TABLE WHERE TABLE = SELECT;", strategy: 'SQL: Reserved Word Collision', category: 'sql' },
      { name: 'sql_invalid_syntax', value: "SELECT * WHERE FROM VALUES (); DROP TABLE users;--", strategy: 'SQL: Invalid Syntax & DROP', category: 'sql' },
      { name: 'sql_comments', value: "1; /* multi line block comment\n continued */ DROP TABLE accounts; -- line comment", strategy: 'SQLi: Multi-line & Block Comments', category: 'sql' },
      { name: 'sql_large_literal', value: `' OR username = '${'B'.repeat(3000)}'`, strategy: 'SQL: Huge String Literal Flooding', category: 'sql' },
      { name: 'sql_unicode', value: "SELECT * FROM users WHERE name = '🔥🤖👾αβγδεñü'", strategy: 'SQL: Extended Unicode Literals', category: 'sql' }
    ];
  }

  static getGoCorpus(): CorpusItem[] {
    return [
      { name: 'go_nil', value: null, strategy: 'Go: Nil Interface / Pointer', category: 'go' },
      { name: 'go_empty_slice', value: [], strategy: 'Go: Empty Slice Boundary', category: 'go' },
      { name: 'go_huge_slice', value: new Array(2000).fill(12345), strategy: 'Go: Large Slice Allocation', category: 'go' },
      { name: 'go_map_mutation', value: { "": null, "0": 0, "key": "value" }, strategy: 'Go: Map Edge Keys', category: 'go' }
    ];
  }

  static getCppCorpus(): CorpusItem[] {
    return [
      { name: 'cpp_nullptr', value: null, strategy: 'C++: Nullptr / 0 Pointer', category: 'cpp' },
      { name: 'cpp_int_overflow', value: 2147483647 + 1, strategy: 'C++: Signed Integer Overflow (32-bit)', category: 'cpp' },
      { name: 'cpp_int_underflow', value: -2147483648 - 1, strategy: 'C++: Signed Integer Underflow (32-bit)', category: 'cpp' },
      { name: 'cpp_empty_vec', value: [], strategy: 'C++: Empty Vector (Index 0 Out of Bounds)', category: 'cpp' },
      { name: 'cpp_neg_index', value: -1, strategy: 'C++: Negative Array Index Boundary', category: 'cpp' }
    ];
  }

  static getSwiftCorpus(): CorpusItem[] {
    return [
      { name: 'swift_nil_optional', value: null, strategy: 'Swift: Nil Optional Unwrapping', category: 'swift' },
      { name: 'swift_empty_arr', value: [], strategy: 'Swift: Empty Array Boundary', category: 'swift' },
      { name: 'swift_unicode_indices', value: "👨‍👩‍👧‍👦🇦🇺🇺🇸😎", strategy: 'Swift: Complex Grapheme Cluster Indices', category: 'swift' },
      { name: 'swift_index_oob', value: 999999, strategy: 'Swift: Index Out of Bounds', category: 'swift' }
    ];
  }

  static getBytesCorpus(): CorpusItem[] {
    return [
      { name: 'bytes_nulls', value: { __omega_bytes_hex: '0000000000000000' }, strategy: 'Binary: Zero Null Bytes', category: 'bytes' },
      { name: 'bytes_high_bit', value: { __omega_bytes_hex: 'ffffffffffffffff7f808182' }, strategy: 'Binary: High Bit & Extrema Bytes', category: 'bytes' },
      { name: 'bytes_xml_raw', value: { __omega_bytes_hex: Buffer.from('<root><item>bytes_fuzz</item></root>', 'utf-8').toString('hex') }, strategy: 'Binary: Raw UTF-8 XML Bytes', category: 'bytes' },
      { name: 'bytes_json_raw', value: { __omega_bytes_hex: Buffer.from('{"key": "bytes_json_fuzz"}', 'utf-8').toString('hex') }, strategy: 'Binary: Raw UTF-8 JSON Bytes', category: 'bytes' },
      { name: 'bytes_invalid_utf8', value: { __omega_bytes_hex: 'c328e282a0f0908d81ffff' }, strategy: 'Binary: Malformed UTF-8 Sequence', category: 'bytes' }
    ];
  }

  static getCorpusForLanguageAndTarget(language: string, targetName: string, sourceCode: string): CorpusItem[] {
    const combined: CorpusItem[] = [];
    const srcLower = (sourceCode || '').toLowerCase();
    const tgtLower = (targetName || '').toLowerCase();

    // Detect if target deals with XML
    if (tgtLower.includes('xml') || srcLower.includes('xml') || srcLower.includes('elementtree') || srcLower.includes('lxml') || srcLower.includes('expat') || srcLower.includes('sax')) {
      combined.push(...this.getXmlCorpus());
    }

    // Detect if target deals with JSON
    if (tgtLower.includes('json') || srcLower.includes('json') || srcLower.includes('loads') || srcLower.includes('parse')) {
      combined.push(...this.getJsonCorpus());
    }

    // Detect if target deals with SQL
    if (language === 'sql' || tgtLower.includes('sql') || tgtLower.includes('query') || srcLower.includes('sqlite') || srcLower.includes('select ') || srcLower.includes('insert ') || srcLower.includes('cursor')) {
      combined.push(...this.getSqlCorpus());
    }

    // Detect if parameter or signature involves bytes or binary data
    if (srcLower.includes('bytes') || srcLower.includes('buffer') || tgtLower.includes('byte') || tgtLower.includes('bin') || srcLower.includes('fromhex') || srcLower.includes('decode(')) {
      combined.push(...this.getBytesCorpus());
    }

    // Add language specific corpora
    if (language === 'go') combined.push(...this.getGoCorpus());
    if (language === 'cpp') combined.push(...this.getCppCorpus());
    if (language === 'swift') combined.push(...this.getSwiftCorpus());
    if (language === 'sql' && combined.length === 0) combined.push(...this.getSqlCorpus());

    // Always mix in standard boundary items if list is low
    if (combined.length < 5) {
      combined.push(
        ...this.getXmlCorpus().slice(0, 3),
        ...this.getJsonCorpus().slice(0, 3),
        ...this.getBytesCorpus().slice(0, 2)
      );
    }

    return combined;
  }
}

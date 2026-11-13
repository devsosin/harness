// node --test plugins/harness/skills/code-order/scripts/rust.test.mjs
import assert from 'node:assert/strict';
import test from 'node:test';
import { reorder } from './rust.mjs';

const src = (lines) => lines.join('\n') + '\n';

test('mod, use groups, const, then each type with its impls and helper fns, tests last', () => {
  const input = src([
    '//! doc',
    'use crate::a::A;',
    'use serde::Deserialize;',
    'use std::fmt;',
    'mod inner;',
    '',
    '#[cfg(test)]',
    'mod tests {',
    '    fn x() {}',
    '}',
    '',
    'fn helper() -> u8 { leaf() }',
    '',
    'fn leaf() -> u8 { 1 }',
    '',
    '/// a type',
    'pub struct Foo;',
    '',
    'const N: usize = 3; // trailing note',
    '',
    'impl fmt::Display for Foo { fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result { Ok(()) } }',
    '',
    'impl Foo { fn n(&self) -> u8 { helper() } }',
    '',
    'pub use inner::Bar;',
  ]);
  assert.equal(reorder(input), src([
    '//! doc',
    '',
    'mod inner;',
    '',
    'use std::fmt;',
    '',
    'use serde::Deserialize;',
    '',
    'use crate::a::A;',
    '',
    'pub use inner::Bar;',
    '',
    'const N: usize = 3; // trailing note',
    '',
    '/// a type',
    'pub struct Foo;',
    '',
    'impl Foo { fn n(&self) -> u8 { helper() } }',
    '',
    'impl fmt::Display for Foo { fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result { Ok(()) } }',
    '',
    'fn helper() -> u8 { leaf() }',
    '',
    'fn leaf() -> u8 { 1 }',
    '',
    '#[cfg(test)]',
    'mod tests {',
    '    fn x() {}',
    '}',
  ]));
});

test('already ordered file is left alone (idempotent)', () => {
  const input = src(['mod a;', '', 'use crate::x;', '', 'struct S;', '', 'impl S {}']);
  assert.equal(reorder(input), null);
  const once = reorder(src(['impl S {}', 'struct S;']));
  assert.equal(reorder(once), null);
});

test('braces inside strings, chars, raw strings, comments and lifetimes do not split items', () => {
  const input = src([
    "impl<'a> W<'a> { fn f(&self) -> char { let _ = r#\"}\"#; let _ = \"{\"; /* } */ '}' } }",
    "struct W<'a>(&'a str);",
    'const C: [u8; 2] = [b\'{\', b\'}\'];',
  ]);
  const out = reorder(input);
  assert.ok(out.startsWith('const C'));
  assert.ok(out.indexOf("struct W<'a>") < out.indexOf("impl<'a> W<'a>"));
});

test('impl of an external type groups by that type; trait impl of a local trait follows the trait', () => {
  const out = reorder(src(['impl Show for u8 {}', 'impl Client for Store {}', 'trait Show {}']));
  assert.equal(out, src(['impl Client for Store {}', '', 'trait Show {}', '', 'impl Show for u8 {}']));
});

test('unknown top-level syntax is refused, not guessed', () => {
  assert.throws(() => reorder('struct A;\n???\n'));
});

test('CRLF files stay CRLF', () => {
  assert.equal(reorder('impl S {}\r\nstruct S;\r\n'), 'struct S;\r\n\r\nimpl S {}\r\n');
});

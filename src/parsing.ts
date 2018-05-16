export interface ParserRule<Token extends { kind: number }, RuleResult> {
  (tokens: Token[]): ParserReturn<RuleResult>;
}
export type ParserReturn<RuleResult> = [RuleResult, number] | false;

export function unwind<FindOutputs, RuleOutput>(
  found: FindResult<FindOutputs>,
  generateRuleOutput: (output: FindOutputs) => RuleOutput
): ParserReturn<RuleOutput> {
  if (found === false) {
    return false;
  }
  const [output, consumedTokens] = found;
  return [generateRuleOutput(output), consumedTokens];
}

// find() returns either:
// - a tuple with:
//   1. an array containing one array for each expected item (with zero or more results in each)
//   2. a number representing the number of tokens consumed
// - or false
export type FindResult<FindOutputs> = [FindOutputs, number] | false;

export function find<
  Token extends { kind: number },
  FindOutputs extends Array<Array<any>>
>(
  parser: { [tokenOrRuleName: string]: ParserRule<Token, any> },
  tokens: Token[],
  expectedSequence: ExpectedTokenOrRule[],
  ignoreTokens: Set<number>
): FindResult<FindOutputs> {
  if (expectedSequence.length === 0) {
    return [([] as any) as FindOutputs, 0];
  }
  const expectedTokenOrRule = expectedSequence[0];
  if (
    expectedTokenOrRule.maximum !== undefined &&
    expectedTokenOrRule.maximum <= 0
  ) {
    // Bail early (recursive case).
    return false;
  }

  // We'll add the result we found at the beginning of the list.
  const results: FindOutputs = ([] as any) as FindOutputs;
  let foundMatch = false;
  let consumedTokens = 0;

  // Skip any ignored tokens.
  while (
    tokens.length > consumedTokens &&
    ignoreTokens.has(tokens[consumedTokens].kind)
  ) {
    consumedTokens++;
  }
  tokens = tokens.slice(consumedTokens);

  if (typeof expectedTokenOrRule.tokenOrRuleName === "string") {
    // We're invoking another parser rule.
    if (!parser[expectedTokenOrRule.tokenOrRuleName]) {
      throw new Error(
        `No rule defined for ${expectedTokenOrRule.tokenOrRuleName}.`
      );
    }
    const ruleParserResult = parser[expectedTokenOrRule.tokenOrRuleName](
      tokens
    );

    if (ruleParserResult) {
      foundMatch = true;
      const [result, usedTokens] = ruleParserResult;
      results.push([result]);
      tokens = tokens.slice(usedTokens);
      consumedTokens += usedTokens;
    } else {
      foundMatch = false;
      results.push([]);
    }
  } else {
    // We're checking for a specific token kind.
    const tokenResult =
      tokens[0] && tokens[0].kind === expectedTokenOrRule.tokenOrRuleName
        ? tokens[0]
        : false;
    if (tokenResult) {
      foundMatch = true;
      results.push([tokenResult]);
      tokens = tokens.slice(1);
      consumedTokens = 1;
    } else {
      foundMatch = false;
      results.push([]);
      consumedTokens = 0;
    }
  }

  if (!foundMatch && expectedTokenOrRule.minimum > 0) {
    // We expected this rule to find something. Bail early.
    return false;
  }

  // Then keep looking for further results.
  // Either we keep finding the same rule (ensuring to decreasing minimum and maximum
  // to take account what we've found already).
  // Note that we don't do this if we haven't found something already, since that would
  // result in an infinite loop.
  const foundNextSelf = !foundMatch
    ? false
    : find<Token, FindOutputs>(
        parser,
        tokens,
        [
          {
            minimum: Math.max(0, expectedTokenOrRule.minimum - 1),
            maximum:
              expectedTokenOrRule.maximum !== undefined
                ? expectedTokenOrRule.maximum - 1
                : undefined,
            tokenOrRuleName: expectedTokenOrRule.tokenOrRuleName
          },
          ...expectedSequence.slice(1)
        ],
        ignoreTokens
      );
  // Or we start going through the rest of the sequence, only if we've satisfied the
  // minimum number of instances found.
  const foundNextRest =
    expectedTokenOrRule.minimum > 1
      ? false
      : find<Token, FindOutputs>(
          parser,
          tokens,
          expectedSequence.slice(1),
          ignoreTokens
        );

  if (foundNextSelf || foundNextRest) {
    let nextResults;
    let nextConsumedTokens;
    if (
      (foundNextSelf && !foundNextRest) ||
      (foundNextSelf && foundNextRest && foundNextSelf[1] > foundNextRest[1])
    ) {
      [nextResults, nextConsumedTokens] = foundNextSelf;
      // Merge results from the same rule into the first place.
      results[0].push(...nextResults[0]);
      results.push(...nextResults.slice(1));
    } else if (foundNextRest) {
      [nextResults, nextConsumedTokens] = foundNextRest;
      results.push(...nextResults);
    } else {
      // This cannot happen.
      throw new Error();
    }
    // Skip any ignored tokens at the end.
    let endIgnoredTokens = 0;
    while (
      tokens.length > nextConsumedTokens + endIgnoredTokens &&
      ignoreTokens.has(tokens[nextConsumedTokens + endIgnoredTokens].kind)
    ) {
      endIgnoredTokens++;
    }
    consumedTokens += nextConsumedTokens + endIgnoredTokens;
    return [results, consumedTokens];
  } else {
    return false;
  }
}

export function optional(
  tokenOrRuleName: string | number
): ExpectedTokenOrRule {
  return {
    minimum: 0,
    maximum: 1,
    tokenOrRuleName
  };
}

export function one(tokenOrRuleName: string | number): ExpectedTokenOrRule {
  return {
    minimum: 1,
    maximum: 1,
    tokenOrRuleName
  };
}

export function atLeast(
  minimum: number,
  tokenOrRuleName: string | number
): ExpectedTokenOrRule {
  return {
    minimum,
    tokenOrRuleName
  };
}

export interface ExpectedTokenOrRule {
  minimum: number;
  maximum?: number;
  tokenOrRuleName: string | number;
}

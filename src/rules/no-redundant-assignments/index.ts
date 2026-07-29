/*
 * SonarQube JavaScript Plugin
 * Copyright (C) 2011-2024 SonarSource SA
 * mailto:info AT sonarsource DOT com
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; either
 * version 3 of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program; if not, write to the Free Software Foundation,
 * Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
 */
// https://sonarsource.github.io/rspec/#/rspec/S4165/javascript

import type { TSESTree } from '@typescript-eslint/types';
import { TSESLint } from '@typescript-eslint/utils';
import { createRule } from '@/utils/create-eslint-rule';
import { peek, CodePathContext, ReachingDefinitions, isDefaultParameter, isCompoundAssignment, isSelfAssignment, reachingDefinitions, resolveAssignedValues, AssignmentContext } from './utils';
import type { Values } from './utils';

export default createRule({
  name: 'no-redundant-assignments',
  meta: {
    schema: [],
    type: 'suggestion',
    docs: {
      description: 'Assignments should not be redundant',
      recommended: 'recommended',
      url: 'https://sonarsource.github.io/rspec/#/rspec/S4165/javascript'
    },
    messages: {
      reviewAssignment:
        'Review this redundant assignment: "{{symbol}}" already holds the assigned value along all execution paths.'
    }
  },
  create(context) {
    const codePathStack: CodePathContext[] = [];
    const reachingDefsMap = new Map<string, ReachingDefinitions>();
    // map from Variable to CodePath ids where variable is used
    const variableUsages = new Map<TSESLint.Scope.Variable, Set<string>>();
    const codePathSegments: TSESLint.CodePathSegment[][] = [];
    const currentCodePathSegments: TSESLint.CodePathSegment[] = [];

    let enumDepth = 0;
    // lazily built lookup tables so each identifier resolves in O(1) instead of
    // scanning every reference/variable of every scope up the scope chain
    let refByIdentifier: Map<TSESTree.Identifier, TSESLint.Scope.Reference> | null = null;
    let variableByDefName: Map<TSESTree.Node, TSESLint.Scope.Variable> | null = null;

    return {
      AssignmentExpression: pushAssignmentContext,
      'VariableDeclarator[init]': pushAssignmentContext,
      'AssignmentExpression:exit': popAssignmentContext,
      'VariableDeclarator[init]:exit': popAssignmentContext,
      TSEnumDeclaration() {
        enumDepth++;
      },
      'TSEnumDeclaration:exit': () => {
        enumDepth--;
      },
      Identifier(node) {
        if (enumDepth > 0) {
          return;
        }
        checkIdentifierUsage(node);
      },
      'Program:exit': () => {
        reachingDefinitions(reachingDefsMap);
        reachingDefsMap.forEach(checkSegment);
        reachingDefsMap.clear();
        variableUsages.clear();
        codePathStack.length = 0;
      },

      // CodePath events
      onCodePathSegmentStart(segment: TSESLint.CodePathSegment) {
        reachingDefsMap.set(segment.id, new ReachingDefinitions(segment));
        currentCodePathSegments.push(segment);
      },
      onCodePathStart(codePath) {
        codePathStack.push(new CodePathContext(codePath));
        codePathSegments.push(currentCodePathSegments);
        currentCodePathSegments.length = 0;
      },
      onCodePathEnd() {
        codePathStack.pop();
        const segmentPop = codePathSegments.pop();
        if (!segmentPop) {
          currentCodePathSegments.length = 0;
        }
      },
      onCodePathSegmentEnd() {
        currentCodePathSegments.pop();
      }
    };

    function popAssignmentContext() {
      const assignment = peek(codePathStack).assignmentStack.pop()!;
      assignment.rhs.forEach(processReference);
      assignment.lhs.forEach(processReference);
    }

    function pushAssignmentContext(node: TSESTree.AssignmentExpression | TSESTree.VariableDeclarator) {
      peek(codePathStack).assignmentStack.push(new AssignmentContext(node));
    }

    function checkSegment(reachingDefs: ReachingDefinitions) {
      const assignedValuesMap = new Map<TSESLint.Scope.Variable, Values>(reachingDefs.in);
      reachingDefs.references.forEach(ref => {
        const variable = ref.resolved;
        if (!variable || !ref.isWrite() || !shouldReport(ref)) {
          return;
        }
        const lhsValues = assignedValuesMap.get(variable);
        const rhsValues = resolveAssignedValues(
          variable,
          ref.writeExpr,
          assignedValuesMap,
          ref.from
        );
        if (lhsValues?.type === 'AssignedValues' && lhsValues.size === 1) {
          const lhsVal = lhsValues.entries().next().value![0];
          checkRedundantAssignment(ref, ref.writeExpr, lhsVal, rhsValues, variable.name);
        }
        assignedValuesMap.set(variable, rhsValues);
      });
    }

    function checkRedundantAssignment(
      { resolved: variable }: TSESLint.Scope.Reference,
      node: TSESTree.Node | null | undefined,
      lhsVal: string | TSESLint.Scope.Variable,
      rhsValues: Values,
      name: string
    ) {
      if (rhsValues.type === 'UnknownValue' || rhsValues.size !== 1) {
        return;
      }
      const rhsVal = rhsValues.entries().next().value![0];
      if (lhsVal === rhsVal && variable && !isWrittenOnlyOnce(variable)) {
        context.report({
          node: node!,
          messageId: 'reviewAssignment',
          data: {
            symbol: name
          }
        });
      }
    }

    // to avoid raising on code like:
    // while (cond) {  let x = 42; }
    function isWrittenOnlyOnce(variable: TSESLint.Scope.Variable) {
      let seen = 0;
      for (let i = 0, len = variable.references.length; i < len; i++) {
        const ref = variable.references[i];
        if (ref.isWrite()) {
          seen++;
          if (seen > 1) {
            return false;
          }
        }
      }
      return seen === 1;
    }

    function shouldReport(ref: TSESLint.Scope.Reference) {
      const variable = ref.resolved;
      return (
        variable
        && !isDefaultParameter(ref)
        && variable.name[0] !== '_'
        && !isCompoundAssignment(ref.writeExpr)
        && !isSelfAssignment(ref)
        && !variable.defs.some(
          def => def.type === TSESLint.Scope.DefinitionType.Parameter || (def.type === TSESLint.Scope.DefinitionType.Variable && !def.node.init)
        )
        && !variableUsedOutsideOfCodePath(variable)
      );
    }

    function variableUsedOutsideOfCodePath(variable: TSESLint.Scope.Variable) {
      return variableUsages.get(variable)!.size > 1;
    }

    function checkIdentifierUsage(node: TSESTree.Identifier) {
      const { ref, variable } = resolveReference(node);
      if (ref) {
        processReference(ref);
      }
      if (variable) {
        const codePathId = peek(codePathStack).codePath.id;
        if (variableUsages.has(variable)) {
          variableUsages.get(variable)!.add(codePathId);
        } else {
          variableUsages.set(variable, new Set<string>([codePathId]));
        }
      }
    }

    function processReference(ref: TSESLint.Scope.Reference) {
      const { assignmentStack } = peek(codePathStack);
      if (assignmentStack.length > 0) {
        peek(assignmentStack).add(ref);
      } else {
        for (let i = 0, l = currentCodePathSegments.length; i < l; i++) {
          reachingDefsForSegment(currentCodePathSegments[i]).add(ref);
        }
      }
    }

    function reachingDefsForSegment(segment: TSESLint.CodePathSegment) {
      let defs;
      if (reachingDefsMap.has(segment.id)) {
        defs = reachingDefsMap.get(segment.id)!;
      } else {
        defs = new ReachingDefinitions(segment);
        reachingDefsMap.set(segment.id, defs);
      }
      return defs;
    }
    function buildResolutionMaps() {
      refByIdentifier = new Map<TSESTree.Identifier, TSESLint.Scope.Reference>();
      variableByDefName = new Map<TSESTree.Node, TSESLint.Scope.Variable>();
      const { scopeManager } = context.sourceCode;
      if (!scopeManager) {
        return;
      }
      const { scopes } = scopeManager;
      for (let i = 0, l = scopes.length; i < l; i++) {
        const scope = scopes[i];
        const { references, variables } = scope;
        for (let j = 0, jl = references.length; j < jl; j++) {
          const ref = references[j];
          refByIdentifier.set(ref.identifier as TSESTree.Identifier, ref);
        }
        for (let j = 0, jl = variables.length; j < jl; j++) {
          const variable = variables[j];
          const { defs } = variable;
          for (let k = 0, kl = defs.length; k < kl; k++) {
            variableByDefName.set(defs[k].name, variable);
          }
        }
      }
    }

    function resolveReference(node: TSESTree.Identifier): { ref: TSESLint.Scope.Reference | null, variable: TSESLint.Scope.Variable | null } {
      if (!refByIdentifier || !variableByDefName) {
        buildResolutionMaps();
      }
      const ref = refByIdentifier!.get(node);
      if (ref) {
        return { ref, variable: ref.resolved };
      }
      return { ref: null, variable: variableByDefName!.get(node) ?? null };
    }
  }
});

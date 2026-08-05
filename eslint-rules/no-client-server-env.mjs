const SERVER_ENV_PATTERN = /(?:^@\/lib\/env\/server$|\/env\/server$)/u;

function isServerEnvImport(source) {
  return typeof source === "string" && SERVER_ENV_PATTERN.test(source);
}

const noClientServerEnv = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Prevent client components from importing the server environment module",
    },
    schema: [],
    messages: {
      forbidden:
        "Client components cannot import the server environment module. Use @/lib/env/public instead.",
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;
    const isClientComponent = sourceCode.ast.body.some(
      (node) =>
        node.type === "ExpressionStatement" && node.directive === "use client",
    );

    if (!isClientComponent) {
      return {};
    }

    return {
      ImportDeclaration(node) {
        if (isServerEnvImport(node.source.value)) {
          context.report({ node, messageId: "forbidden" });
        }
      },
      ImportExpression(node) {
        if (
          node.source.type === "Literal" &&
          isServerEnvImport(node.source.value)
        ) {
          context.report({ node, messageId: "forbidden" });
        }
      },
    };
  },
};

export default noClientServerEnv;

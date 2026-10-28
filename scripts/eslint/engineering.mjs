// Project boundaries that cannot be expressed by an existing ESLint rule.
const engineering = {
  rules: {
    "no-dynamic-radix": {
      meta: {
        type: "problem",
        schema: [],
        messages: { raw: "通过 components/ui/ 加载 Radix 封装组件，动态导入同样遵守 UI 分层。" },
      },
      create(context) {
        return {
          ImportExpression(node) {
            const source = node.source.type === "Literal" ? node.source.value
              : node.source.type === "TemplateLiteral" && node.source.expressions.length === 0
                ? node.source.quasis[0].value.cooked : null;
            if (typeof source === "string" && /^(?:@radix-ui\/|radix-ui(?:\/|$))/.test(source)) {
              context.report({ node, messageId: "raw" });
            }
          },
        };
      },
    },
    "require-server-only": {
      meta: {
        type: "problem",
        schema: [],
        messages: {
          missing: '服务端模块必须显式 import "server-only"，让 Next.js 检查客户端的传递依赖。见 CODING_STANDARDS.md。',
        },
      },
      create(context) {
        return {
          Program(node) {
            const guarded = node.body.some(
              (statement) => statement.type === "ImportDeclaration"
                && statement.source.value === "server-only"
                && statement.importKind !== "type"
                && statement.specifiers.length === 0,
            );
            if (!guarded) context.report({ node, messageId: "missing" });
          },
        };
      },
    },
  },
};

export default engineering;

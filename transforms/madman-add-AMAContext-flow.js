// Press ctrl+space for code completion
export default function transformer(file, api) {
  const j = api.jscodeshift;
  let root = j(file.source);

  const loggerExpressions = root.find(j.MemberExpression, { property: { name: "logger" } }).filter(path => {
    return path.node.object.property.name === "ama";
  });
  if (!loggerExpressions.length) {
    return;
  }
  const typeProperties = root.find(j.ObjectTypeProperty, {
    key: { name: "ama" }
  });

  const propTypeProperties = root.find(j.Property, { key: { name: "ama" } });

  if (typeProperties.length || propTypeProperties.length) {
    return;
  }

  const propTypes = root.find(j.Identifier, { name: "propTypes" });

  const typeAliases = root.find(j.TypeAlias, { id: { name: "Props" } });
  if (!typeAliases.length && !propTypes.length) {
    return;
  }

  const importDeclarations = root.find(j.ImportDeclaration, { source: { value: "AMAAppInstanceContainer" } });
  if (importDeclarations.length) {
    return;
  }

  if (typeAliases.length) {
    const typeAlias = typeAliases.get();
    typeAlias.node.right.properties.push(j.objectTypeProperty(j.identifier("ama"), j.genericTypeAnnotation(j.identifier("AMAContext"), null), false));

    const amaContextType = j.importDeclaration([j.importSpecifier(j.identifier("AMAContext"), j.identifier("AMAContext"))], j.literal("AMAAppInstanceContainer"));
    amaContextType.importKind = "type";
    typeAlias.insertBefore(amaContextType);
  } else if (propTypes.length) {
    const amaPropTypeNode = j.property(
      "init",
      j.identifier("ama"),
      j.memberExpression(j.memberExpression(j.identifier("PropTypes"), j.identifier("object")), j.identifier("isRequired"))
    );

    propTypes.get().parent.node.value.properties.push(amaPropTypeNode);
  }

  return root.toSource();
}

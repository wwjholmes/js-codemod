// Press ctrl+space for code completion
export default function transformer(file, api) {
  const j = api.jscodeshift;
  let root = j(file.source);

  if (!_hasOldLogger(j, root)) {
    return;
  }

  if (!_isReactJSModule(j, root)) {
    return;
  }

  _addAMAAppInstanceContainerRequire(j, root);
  _removeAdsManagerLoggerRquire(j, root);
  _renameAdsManagerLoggerCall(j, root);
  _addHocWrapper(j, root);

  return root.toSource();
}

// Step 1: remove require AdsManagerLogger
function _removeAdsManagerLoggerRquire(j, root) {
  root
    .find(j.VariableDeclarator, {
      id: { name: "AdsManagerLogger" }
    })
    .remove();
}

// Step 2: require AMAAppInstanceContainer
function _addAMAAppInstanceContainerRequire(j, root) {
  if (_hasRequiredHoc(j, root)) {
    return;
  }

  const requireCallExpressions = root.find(j.CallExpression, {
    callee: {
      type: "Identifier",
      name: "require"
    }
  });

  if (requireCallExpressions.length > 0) {
    const varDeclaration = requireCallExpressions.get(0).parent.parent;
    j(varDeclaration).insertAfter(path => {
      return j.variableDeclaration("const", [j.variableDeclarator(j.identifier("AMAAppInstanceContainer"), j.callExpression(j.identifier("require"), [j.literal("AMAAppInstanceContainer")]))]);
    });
  }
}

// Step 3: rename AdsManagerLogger.xxx to this.props.ama.logger.xxx
function _renameAdsManagerLoggerCall(j, root) {
  const loggerCalls = root.find(j.MemberExpression, {
    object: { name: "AdsManagerLogger" }
  });

  if (loggerCalls && loggerCalls.length > 1) {
    loggerCalls &&
      loggerCalls.replaceWith(path => {
        return j.memberExpression(j.memberExpression(j.memberExpression(j.memberExpression(j.thisExpression(), j.identifier("props")), j.identifier("ama")), j.identifier("logger")), path.node.property);
      });

    // add ama to `type Props = {...}` if needed
    const typeAliases = root.find(j.TypeAlias, { id: { name: "Props" } });
    if (typeAliases && typeAliases.length) {
      const typeAlias = typeAliases.get();
      typeAlias.node.right.properties.push(j.objectTypeProperty(j.identifier("ama"), j.genericTypeAnnotation(j.identifier("Object"), null), false));
    }
  }
}

// Step 4: wrap JS module by AMAAppInstanceContainer HOC if needed

function _addHocWrapper(j, root) {
  if (_hasWrappedByHoc(j, root)) {
    return;
  }

  const createReactClassDeclarators = root.find(j.VariableDeclarator, { init: { callee: { name: "createReactClass" } } });
  if (createReactClassDeclarators && createReactClassDeclarators.length > 0) {
    const firstPath = createReactClassDeclarators.get();
    const moduleName = firstPath.node.id.name;
    const hocNode = j.expressionStatement(
      j.assignmentExpression("=", j.identifier(moduleName), j.callExpression(j.memberExpression(j.identifier("AMAAppInstanceContainer"), j.identifier("create")), [j.identifier(moduleName)]))
    );

    j(firstPath.parent).insertAfter(function(path) {
      return hocNode;
    });
  } else {
    const classDeclarations = root.find(j.ClassDeclaration);
    if (!classDeclarations || classDeclarations.length == 0) {
      return;
    }
    const lastClass = classDeclarations.paths()[classDeclarations.paths().length - 1];
    if (!lastClass) {
      return;
    }
    const moduleName = lastClass.node.id.name;

    const hocNode = j.expressionStatement(
      j.assignmentExpression("=", j.identifier(moduleName), j.callExpression(j.memberExpression(j.identifier("AMAAppInstanceContainer"), j.identifier("create")), [j.identifier(moduleName)]))
    );

    j(lastClass).insertAfter(function(path) {
      return hocNode;
    });
  }
}

// check if JS module has AMAAppInstanceContainer hoc already
function _hasWrappedByHoc(j, root) {
  const hocExpressions = root.find(j.MemberExpression, {
    object: { type: "Identifier", name: "AMAAppInstanceContainer" }
  });
  return hocExpressions && hocExpressions.length > 0;
}

// check if AMAAppInstanceContainer has been declared already
function _hasRequiredHoc(j, root) {
  const hocDeclarators = root.find(j.VariableDeclarator, {
    id: { name: "AMAAppInstanceContainer" }
  });
  return hocDeclarators && hocDeclarators.length > 0;
}

// check if AMAAppInstanceContainer has been declared already
function _hasOldLogger(j, root) {
  const oldLoggerDeclarators = root.find(j.VariableDeclarator, {
    id: { name: "AdsManagerLogger" }
  });
  return oldLoggerDeclarators && oldLoggerDeclarators.length > 0;
}

// check if this is a React component
function _isReactJSModule(j, root) {
  return !!root.find(j.MethodDefinition, { key: { name: "render" } }).length || !!root.find(j.Identifier, { name: "createReactClass" }).length;
}

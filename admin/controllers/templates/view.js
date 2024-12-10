angular.module('santedb').controller("EmrTemplateViewController", ["$scope", "$rootScope", "$state", "$timeout", "$stateParams", function ($scope, $rootScope, $state, $timeout, $stateParams) {

    async function initializeView(id) {
        try {
            var definition = await SanteDB.resources.dataTemplateDefinition.getAsync(id, "full");

            // Template josn
            if (definition.template && definition.template.type === "reference") {
                try {
                    var rawApi = new APIWrapper({
                        idByQuery: false,
                        base: ""
                    });

                    definition.templateJson = await rawApi.getAsync({
                        resource: definition.template.template,
                    });
                }
                catch (e) {
                    console.warn(e);
                }
            }

            // Resolve the scopes
            if (definition.scopes) {
                definition.scopeModel = await Promise.all(definition.scopes.map(async function (s) {
                    try {
                        return await SanteDB.resources.concept.getAsync(s, "fastView");
                    }
                    catch (e) {
                        return s;
                    }
                }));
            }
            $timeout(() => $scope.templateDefinition = definition);
        }
        catch (e) {
            $rootScope.errorHandler(e);
        }
    }

    initializeView($stateParams.id);

    $scope.setActive = async function (state) {
        try {

            var patch = new Patch({
                appliesTo: {
                    type: "DataTemplateDefinition",
                    id: $scope.templateDefinition.id
                },
                change: [
                    {
                        op: PatchOperationType.Replace,
                        path: "active",
                        value: state
                    }
                ]
            });

            var result = await SanteDB.resources.dataTemplateDefinition.patchAsync($scope.templateDefinition.id, null, patch);

            $timeout(() => $scope.templateDefinition.active = state);
        }
        catch (e) {
            $rootScope.errorHandler(e);
        }
    }

}]);
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
                        resource: definition.template.content,
                    });
                }
                catch (e) {
                    console.warn(e);
                }
            }
            else {
                definition.templateJson = JSON.parse(definition.template.content);
            }

            // Fill out the data
            if(definition.templateJson && definition.templateJson.$type)
            {
                try {
                    definition.filledJson = await SanteDB.application.getTemplateContentAsync(definition.mnemonic, {
                        recordTargetId: SanteDB.application.newGuid(),
                        facilityId: await SanteDB.authentication.getCurrentFacilityId() || SanteDB.application.newGuid(),
                        userEntityId: await SanteDB.authentication.getCurrentUserEntityId() || SanteDB.application.newGuid()
                    });
                }
                catch(e) {
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
            else {
                definition.scopes = [];
            }
            $timeout(() => $scope.templateDefinition = definition);
        }
        catch (e) {
            $rootScope.errorHandler(e);
        }
    }

    $scope.loadTemplate = initializeView;
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
            toastr.success(SanteDB.locale.getString("ui.emr.admin.templates.save.success"));
        }
        catch (e) {
            $rootScope.errorHandler(e);
        }
    }

}]);
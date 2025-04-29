/*
 * Copyright (C) 2021 - 2025, SanteSuite Inc. and the SanteSuite Contributors (See NOTICE.md for full copyright notices)
 * Portions Copyright (C) 2019 - 2021, Fyfe Software Inc. and the SanteSuite Contributors
 * Portions Copyright (C) 2015-2018 Mohawk College of Applied Arts and Technology
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you
 * may not use this file except in compliance with the License. You may
 * obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations under
 * the License.
 *
 */
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
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
angular.module("santedb").controller("EmrAdminCarePathEditController", ["$scope", "$rootScope", "$timeout", "$stateParams", "$state", function($scope, $rootScope, $timeout, $stateParams, $state) {


    // Initialize the view
    async function initializeView(pathwayId) {
        try {
            var pathway = null;
            if(pathwayId) {
                pathway = await SanteDB.resources.carePathwayDefinition.getAsync(pathwayId);
                pathway.enrollment = `${pathway.enrollment}`;
                pathway.eligibility = pathway.eligibility.split("&").map(o => { return { expr: o }});
            }
            else {
                pathway = new CarePathwayDefinition({
                    eligibility: [],
                    enrollment: 0
                });
            }

            $timeout(() => $scope.pathway = pathway);
        }
        catch(e) {
            $rootScope.errorHandler(e);
        }
    }

    async function saveCarePath(carePathForm) {
        if(carePathForm.$invalid) return;

        try {

            // Collapse the eligibility criteria
            $scope.pathway.eligibility = $scope.pathway.eligibility.map(o=>o.expr).join("&");
            if($scope.pathway.id) {
                await SanteDB.resources.carePathwayDefinition.updateAsync($scope.pathway.id, $scope.pathway);
            }
            else {
                await SanteDB.resources.carePathwayDefinition.insertAsync($scope.pathway);
            }
            toastr.success(SanteDB.locale.getString("ui.emr.admin.carePath.save.success"));
            $state.go("santedb-admin.emr.carePaths.index");
        }
        catch(e) {
            $rootScope.errorHandler(e);
        }
    }

    initializeView($stateParams.id);

    $scope.saveCarePath = saveCarePath;
}]);
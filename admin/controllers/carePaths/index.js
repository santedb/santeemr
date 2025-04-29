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
angular.module("santedb").controller("EmrAdminCarePathController", ["$scope", "$rootScope", "$timeout", function($scope, $rootScope, $timeout) {

    $scope.renderEnrollment = (r) => r.enrollment == 0 ? "Manual" : "Auto";

    $scope.renderEligibility = (r) => `<code>${r.eligibility.replaceAll("<", "lt;").split("&").join("<br/>").replaceAll("lt;", "&lt;")}</code>`;

    $scope.deleteCarePath = async function(id) {
        if(confirm(SanteDB.locale.getString("ui.emr.admin.carePath.delete.confirm"))) {
            try {
                await SanteDB.resources.carePathwayDefinition.deleteAsync(id);
                toastr.success(SanteDB.locale.getString("ui.emr.admin.carePath.delete.success"));
                $("#carePathTable").attr("newQueryId", true);
                $("#carePathTable table").DataTable().draw();
            }
            catch (e) {
                $rootScope.errorHandler(e);
            }
        }
    }
}]);
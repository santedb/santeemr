/// <reference path="../../.ref/js/santedb.js"/>
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
angular.module('santedb').controller('SystemInfoController', ["$scope", "$rootScope", "$state", "$interval", function ($scope, $rootScope, $state, $interval) {


    $scope.isLocalLoading = true;

    // Get application information
    SanteDB.application.getAppInfoAsync({ updates: false })
        .then(function(d) {
            $scope.info = d;
            $scope.info._device = SanteDB.configuration.getDeviceId();
            $scope.isLocalLoading = false;
            $scope.$apply();
        })
        .catch($rootScope.errorHandler);

   
    $scope.doUpdate = async function() {
        try {
            SanteDB.display.buttonWait("#btnUpdate", true);
            await SanteDB.application.doUpdateAsync();
        } catch(e) {
            $rootScope.errorHandler(e);
        }
        finally {
            SanteDB.display.buttonWait("#btnUpdate", false);

        }
    }

    $scope.enableService = async function(serviceId) {
        if(confirm(SanteDB.locale.getString("ui.emr.system.confirm.enableService"))) {
            try {
                serviceId = serviceId.substr(0, serviceId.indexOf(','));
                await SanteDB.api.app.postAsync({
                    resource: `Configuration/Service/${serviceId}`,
                    data: {},
                    contentType: 'application/json'
                });
                $scope.info = await SanteDB.application.getAppInfoAsync({ updates: false });
                alert(SanteDB.locale.getString('ui.emr.system.confirm.serviceChange'));
                try {
                    $scope.$apply();
                } catch(e) {}
            }
            catch(e) {
                $rootScope.errorHandler(e);
            }
        }
    }

    $scope.disableService = async function(serviceId) {
        if(confirm(SanteDB.locale.getString("ui.emr.system.confirm.disableService"))) {
            try {
                serviceId = serviceId.substr(0, serviceId.indexOf(','));
                await SanteDB.api.app.deleteAsync({
                    resource: `Configuration/Service/${serviceId}`,
                });

                $scope.info = await SanteDB.application.getAppInfoAsync({ updates: false });
                alert(SanteDB.locale.getString('ui.emr.system.confirm.serviceChange'));
                try {
                    $scope.$apply();
                } catch(e) {}
            }
            catch(e) {
                $rootScope.errorHandler(e);
            }
        }
    }
}]);
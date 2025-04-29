/// <reference path="../../../.ref/js/santedb.js"/>
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
angular.module('santedb').controller("EmrBackupIndexController", ["$scope", "$rootScope", "$timeout", function ($scope, $rootScope, $timeout) {

    var _newBackup = {
        media: "Private",
        encrypt: true
    }
    $scope.backupMedia = "Private";
    $scope.renderSize = (r) => `${(r.size / 1024).toFixed(2)} kb`;
    $scope.renderTimestamp = (r) => moment(r.timestamp).format(SanteDB.locale.dateFormats.full);
    $scope.renderEncrypted = (r) => r.encrypted ? '<i class="fas fa-check"></i>' : null;

    $scope.$watch("newBackup.password", function(n) {
        if (n)
            $scope.strength = SanteDB.application.calculatePasswordStrength(n);
        else 
            delete $scope.strength;
    });
    $scope.$watch("backupMedia", function(n,o) {
        if(n && o && n!=o) {
            $timeout(() => $("#SystemBackupTable table").DataTable().draw());
        }
    });

    $scope.deleteBackup = async function(i) {
        if(confirm(SanteDB.locale.getString("ui.emr.backup.delete.confirm", { label: i }))) {
            try {
                await SanteDB.resources.backup.removeAssociatedAsync($scope.backupMedia, "Descriptor", i);
                $("#SystemBackupTable table").DataTable().draw();
                toastr.success(SanteDB.locale.getString("ui.emr.backup.delete.success", { label: i }));
            }
            catch(e) {
                $rootScope.errorHandler(e);
            }
        }
    }

    $scope.restoreBackup = async function(label, passkey) {
        if(confirm(SanteDB.locale.getString("ui.emr.backup.restore.confirm", { label: label }))) {
            $timeout(() => $scope.restoration = label);
            try {
                SanteDB.display.buttonWait("#btnDoRestore", true);
                await SanteDB.resources.backup.invokeOperationAsync($scope.backupMedia, "restore", { label: label || $scope.restoreParm.label, password: passkey || $scope.restoreParm.password });
                toastr.success(SanteDB.locale.getString("ui.emr.backup.restore.success"));
                $scope.restoreParm = {};
                $("#restoreModal").modal('hide');
            }
            catch(e) {
                $rootScope.errorHandler(e);
            }
            finally {
                SanteDB.display.buttonWait("#btnDoRestore", false);

            }
        }
    }

    $scope.showRestoreControl = async function(label) {
        try {
            var backup = await SanteDB.resources.backup.getAssociatedAsync($scope.backupMedia, "Descriptor", label);
            if(backup.encrypted) {
                $timeout(() => {
                    $scope.restoreParm = { label: label };
                    $("#restoreModal").modal({ backdrop: 'static' });
                });
            }
            else {
                await $scope.restoreBackup(label);
            }
        }
        catch(e) {
            $rootScope.errorHandler(e);
        }
    }
    $scope.showBackupControl = function() {
        $scope.newBackup = angular.copy(_newBackup);
        $("#backupModal").modal({ backdrop: 'static' });
    }

    $scope.backupNow = async function(backupForm) {
        try {
            SanteDB.display.buttonWait("#btnDoBackup", true);
            await SanteDB.resources.backup.invokeOperationAsync($scope.newBackup.media, "backup", { password: $scope.newBackup.password });
            toastr.success(SanteDB.locale.getString("ui.emr.backup.now.success"));
            $("#backupModal").modal('hide');
            $timeout(() => $("#SystemBackupTable table").DataTable().draw());

        }
        catch(e) {
            $rootScope.errorHandler(e);
        }
        finally {
            SanteDB.display.buttonWait("#btnDoBackup", false)
        }
    }
}]);
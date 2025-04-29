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
angular.module('santedb').controller("EmrBackupViewController", ["$scope", "$rootScope", "$timeout", "$stateParams", "$state", function ($scope, $rootScope, $timeout, $stateParams, $state) {


    async function initializeView(id) {
        try {
            var backup = await SanteDB.resources.backup.getAssociatedAsync("Any", "Descriptor", id);
            var classes = await SanteDB.resources.backup.getAsync("classes");
            backup.assets.forEach(a => a.className = classes[a.classId]);
            $timeout(() => $scope.backup = backup);
        }
        catch(e) {
            $rootScope.errorHandler(e);
        }
    }

    if($stateParams.id) {
        initializeView($stateParams.id);
    }
    else {
        $state.go("santedb-emr.system.backup.index");
    }

}]);
/// <reference path="../../../.ref/js/santedb.js"/>
/// <reference path="../../../.ref/js/santedb-model.js"/>
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
angular.module('santedb').controller('EmrPatientConditionWidgetController', ['$scope','$rootScope','$timeout', function($scope, $rootScope, $timeout){
    $scope.isLoading = true;

    const initializeView = async function(patientId)
    {
        let haserror = false;
        let scopeconditions = [];

        try {
            let conditions = await SanteDB.resources.act.findAsync({
                "participation[RecordTarget].player": patientId,
                "typeConcept": "236b5641-61d2-4d12-91f7-5dddbd7f8931", // Condition
                "statusConcept": [ StatusKeys.Active, StatusKeys.Completed ]
            }, 'full');

            if (!conditions)
            {
                haserror = true;
            }
            else {
                scopeconditions = conditions.resource;
                console.log(scopeconditions);
            }
        }
        finally {
            $timeout(() => {
                $scope.isLoading = false;
                $scope.hasError = haserror;
                $scope.conditions = scopeconditions;
            });
        }
    };

    $scope.resolveSummaryTemplate = SanteEMR.resolveSummaryTemplate;
    $scope.resolveTemplateIcon = SanteEMR.resolveTemplateIcon;
    $scope.$timeout = $timeout;

    console.log($scope.renderStatus);

    initializeView($scope.scopedObject.id);
}]);
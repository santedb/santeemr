/// <reference path="../../../../.ref/js/santedb.js"/>
/*
 * Portions Copyright 2015-2019 Mohawk College of Applied Arts and Technology
 * Portions Copyright 2019-2019 SanteSuite Contributors (See NOTICE)
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
 */
angular.module('santedb').controller('AuditDataController', ["$scope", "$state", function ($scope, $state) {



    $scope.navigateObject = function (code, id) {
        var type = "IdentifiedData";
        switch (code) {
            case "PAT":
            case "Patient":
                type = "Patient";
                break;
            case "PLC":
            case "Place":
                type = "Place";
                break;
            case "MAT":
            case "Material":
            case "MMAT":
            case "ManufacturedMaterial":
                type = "Material";
                break;
            case "ORG":
            case "Organization":
                type = "Organization";
                break;
            case "PSN":
            case "Person":
                type = "Person";
                break;
            default:
                return;
        }

        SanteDB.application.callResourceViewer(type, $state, { id: id });
    }
}]);
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
angular.module('santedb').controller('AuditNetworkController', ["$scope", function ($scope) {

    // Render the action column
    $scope.renderAction = function (audit) {

       var retVal = "";
       switch (audit.action) {
           case "Read":
               retVal = "<i class='fas fa-database text-success fa-fw'></i> ";
               break;
           case "Create":
           case "Update":
           case "Delete":
               retVal = "<i class='fas fa-database text-danger fa-fw'></i> ";
               break;
           case "Execute":
               retVal = "<i class='fas fa-play'></i> ";
               break;
       }
       retVal += audit.action;
       return retVal;
   }

}]);
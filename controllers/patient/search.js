/// <reference path="../../.ref/js/santedb.js"/>
/// <reference path="../../.ref/js/santedb-model.js"/>
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
 * 
 * User: Justin Fyfe
 * Date: 2019-9-27
 */
angular.module('santedb').controller('EmrPatientSearchController', ["$scope", "$rootScope", "$state", "$templateCache", "$stateParams", function ($scope, $rootScope, $state, $templateCache, $stateParams) {

    
    
    // Render demographic information
    $scope.renderDemographics = renderPatientSummary;

    // Render address
    $scope.renderAddress = function(patient) {
        
        var retVal = "";
        if(patient.address)
            Object.keys(patient.address).forEach(function(n) 
            {
                retVal += `${SanteDB.display.renderEntityAddress(patient.address[n])} ,`;
            });
        else 
            retVal = "N/A ";
        return retVal.substr(0, retVal.length - 1);
    }

    // Render the names
    $scope.renderName = function(patient) {
        
        var retVal = "";
        if(patient.name)
            Object.keys(patient.name).forEach(function(n) 
            {
                retVal += `${SanteDB.display.renderEntityName(patient.name[n])}  ,`;
            });
        else 
            retVal = "N/A ";
        return retVal.substr(0, retVal.length - 1);
    }

    // Render DOB
    $scope.renderDob = function(patient) {
        if(patient.dateOfBirth)
            return SanteDB.display.renderDate(patient.dateOfBirth, patient.dateOfBirthPrecision);
        else
            return "N/A";
    }

    // Render the patient's gender
    $scope.renderGender = function(patient) {
        var retVal = "";
        switch(patient.genderConcept) {
            case "f4e3a6bb-612e-46b2-9f77-ff844d971198":
                retVal += '<i class="fas fa-male"></i> ';
                break;
            case "094941e9-a3db-48b5-862c-bc289bd7f86c":
                retVal += '<i class="fas fa-female"></i> ';
                break;
            default:
                retVal += '<i class="fas fa-question-circle"></i> ';
        }

        if(patient.genderConceptModel.mnemonic) {
            retVal += SanteDB.display.renderConcept(patient.genderConceptModel);
        }
        return retVal;
    }

    // Render identifiers
    $scope.renderIdentifier = function(patient) {

        var preferred = $rootScope.system.config.application.setting['aa.preferred'];

        var retVal = "";
        if(patient.identifier) {
            Object.keys(patient.identifier).forEach(function(id) {
                if(preferred && id == preferred || !preferred)
                    retVal += `${patient.identifier[id].value} <span class="badge badge-dark">${ patient.identifier[id].authority ? patient.identifier[id].authority.name : id }</span> ,`;
            });
        }

        else retVal += "N/A ";
        return retVal.substring(0, retVal.length - 1);
    }

    // Search MPI
    $scope.searchMpi = function(formData) {
        if(formData != null && formData.$invalid)
            return;
        
        // Build query and bind query to the search table
        var queryObject = {
            "_e" : Math.random(), 
            "_orderBy" : "creationTime:desc",
            "_any" : $scope.search.val,
            "_upstream": $scope.search._upstream
        };

        $scope.$parent.lastSearch = {
            search: $scope.search
        };
        $scope.$parent.lastSearch.filter = $scope.filter = queryObject;
        
    }

    // Search if needed
    if($scope.$parent.lastSearch) {
        $scope.filter = $scope.$parent.lastSearch.filter;
        $scope.search = $scope.$parent.lastSearch.search;
    }
    else {
        // Current search 
        $scope.search = {
                val: $stateParams.q
            };

        if($stateParams.q)
            $scope.searchMpi();
    }
    

    // Scan 
    $scope.scanSearch = async function() {
        try {

            SanteDB.display.buttonWait("#btnScan", true);

            var result = await searchByBarcode();
            if(!result)
                return;
            else if(result.$type == "Bundle") 
            {
                $scope.search.val = result.$search;
                $scope.searchMpi();
            }
            else {
                // now we want to redirect the state change
                // TODO: Have this change redirection based on type of the data
                var stateResolve = SanteDB.display.getResourceDisplayState(result);
                if (stateResolve) {
                    if (result.$novalidate)
                        toastr.warning(SanteDB.locale.getString(`ui.model.${result.$type}._code.validation`), null, {
                            preventDuplicates: true,
                            positionClass: "toast-bottom-center",
                            showDuration: 500,
                            hideDuration: 500,
                            timeout: "0",
                            extendedTimeout: "0"
                        });
                    stateResolve(result, $state);
                }
                else
                    throw new Exception("Exception", `Cannot determine how to display ${result.$type}`);
            }

        }
        catch (e) {
            $rootScope.errorHandler(e);
        }
        finally {
            SanteDB.display.buttonWait("#btnScan", false);
        }
    }
}]);
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
    $scope.renderDemographics = function (patient) {

        var retVal = "";
        if (patient.name) {
            var key = Object.keys(patient.name)[0];
            retVal += `<strong>${SanteDB.display.renderEntityName(patient.name[key])}</strong>`;
        }
        if (patient.identifier) {
            retVal += "<span class='badge badge-secondary'>";
            if (patient.identifier.MOHS_GEN_NHID)
                retVal += `<i class="fas fa-id-card"></i> ${SanteDB.display.renderIdentifier(patient.identifier, 'MOHS_GEN_NHID')}`;
            else {
                var key = Object.keys(patient.identifier)[0];
                retVal += `<i class="far fa-id-card"></i> ${SanteDB.display.renderIdentifier(patient.identifier, key)}`;
            }
            retVal += `</span><br/>`;
        }

        
        if(patient.address) {
            var key = Object.keys(patient.address)[0];
            retVal += `<em><i class="fas fa-city"></i> ${SanteDB.display.renderEntityAddress(patient.address[key])}</em><br/>`;
        }

        retVal += `<i class='fas fa-birthday-cake'></i> ${SanteDB.display.renderDate(patient.dateOfBirth, patient.dateOfBirthPrecision)} `;

        // Deceased?
        if (retVal.deceasedDate)
            retVal += `<span class='badge badge-dark'>${SanteDB.locale.getString("ui.model.patient.deceased")}</span>`;

        // Gender
        switch (patient.genderConceptModel.mnemonic) {
            case 'Male':
                retVal += `<i class='fas fa-male' title="${SanteDB.display.renderConcept(patient.genderConceptModel)}"></i> ${SanteDB.display.renderConcept(patient.genderConceptModel)}`;
                break;
            case 'Female':
                retVal += `<i class='fas fa-female' title="${SanteDB.display.renderConcept(patient.genderConceptModel)}"></i> ${SanteDB.display.renderConcept(patient.genderConceptModel)}`;
                break;
            default:
                retVal += `<i class='fas fa-restroom' title="${SanteDB.display.renderConcept(patient.genderConceptModel)}"></i> ${SanteDB.display.renderConcept(patient.genderConceptModel)}`;
                break;
        }
        if (patient.address) {

        }

        return retVal;
    }

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
    

}]);
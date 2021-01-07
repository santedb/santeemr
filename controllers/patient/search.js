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
    $scope.renderAddress = function (patient) {

        var retVal = "";
        if (patient.address)
            Object.keys(patient.address).forEach(function (n) {
                retVal += `${SanteDB.display.renderEntityAddress(patient.address[n])} ,`;
            });
        else
            retVal = "N/A ";
        return retVal.substr(0, retVal.length - 1);
    }

    // Render the names
    $scope.renderName = function (patient) {

        var retVal = "";
        if (patient.name)
            Object.keys(patient.name).forEach(function (n) {
                retVal += `${SanteDB.display.renderEntityName(patient.name[n])}  ,`;
            });
        else
            retVal = "N/A ";
        return retVal.substr(0, retVal.length - 1);
    }


    // Render DOB
    $scope.renderDob = function (patient) {
        if (patient.dateOfBirth)
            return SanteDB.display.renderDate(patient.dateOfBirth, patient.dateOfBirthPrecision);
        else
            return "N/A";
    }

    // Render the patient's gender
    $scope.renderGender = function (patient) {
        var retVal = "";
        switch (patient.genderConcept) {
            case "f4e3a6bb-612e-46b2-9f77-ff844d971198":
                retVal += '<i class="fas fa-male"></i> ';
                break;
            case "094941e9-a3db-48b5-862c-bc289bd7f86c":
                retVal += '<i class="fas fa-female"></i> ';
                break;
            default:
                retVal += '<i class="fas fa-question-circle"></i> ';
        }

        if (patient.genderConceptModel.mnemonic) {
            retVal += SanteDB.display.renderConcept(patient.genderConceptModel);
        }
        return retVal;
    }

    // Render identifiers
    $scope.renderIdentifier = function (patient) {

        var preferred = $rootScope.system.config.application.setting['aa.preferred'];

        var retVal = "";
        if (patient.identifier) {
            Object.keys(patient.identifier).forEach(function (id) {
                if (preferred && id == preferred || !preferred) {
                    if (Array.isArray(patient.identifier[id]))
                        retVal += `${patient.identifier[id].map(function (d) { return d.value }).join(' or ')} <span class="badge badge-dark">${patient.identifier[id].authority ? patient.identifier[id].authority.name : id}</span> ,`;
                    else
                        retVal += `${patient.identifier[id].value} <span class="badge badge-dark">${patient.identifier[id].authority ? patient.identifier[id].authority.name : id}</span> ,`;
                }
            });
        }

        else retVal += "N/A ";
        return retVal.substring(0, retVal.length - 1);
    }

    // Validate the advanced search 
    // At least 3 fuzzy fields must be filled OR an identifier
    $scope.validateAdvancedSearch = function() {
        if(!$scope.search._advanced) return false;

        var fields = 0, advanced = $scope.search.advanced;
        var address= (advanced.address.$other[0].component || {});
        var name = (advanced.name.$other[0].component || {});
        if(name.Given || name.Family) fields++;
        if(advanced.identifier) fields += 3; // identifier= pass
        if(address.City || address.State || address.StreetAddressLine || address.County) fields++;
        if(advanced.genderConcept) fields++;
        if(advanced.dateOfBirth.from || advanced.dateOfBirth.to) fields++;

        return fields >= 3;
    }

    // Search MPI
    $scope.searchMpi = async function (formData) {
        if (formData != null && formData.$invalid)
            return;

        try {
            SanteDB.display.buttonWait("#btnSearchSubmit", true);
            // Ask the user if they want to search upstream, only if they are allowed
            var session = await SanteDB.authentication.getSessionInfoAsync();

            if (session.method == "LOCAL" && $scope.search._upstream) // Local session so elevate to use the principal elevator
            {
                var elevator = new ApplicationPrincipalElevator(true);
                await elevator.elevate(session);
                SanteDB.authentication.setElevator(elevator);
            }

            if ($scope.search._advanced) {

                var advanced = $scope.search.advanced;

                var queryObject = {
                    "_e": Math.random(),
                    "_orderBy": "creationTime:desc",
                    "_upstream": $scope.search._upstream
                };

                // Query 
                if(advanced.name.$other[0].component){
                    if(advanced.name.$other[0].component.Given)
                        queryObject["name.component[Given].value"] = `:(approx|"${advanced.name.$other[0].component.Given}")`;
                    if(advanced.name.$other[0].component.Family)
                        queryObject["name.component[Family].value"] = `:(approx|"${advanced.name.$other[0].component.Family}")`;
                }
                if(advanced.address.$other[0].component)
                {
                    if(advanced.address.$other[0].component.City)
                        queryObject["address.component[City].value"] = advanced.address.$other[0].component.City;
                    if(advanced.address.$other[0].component.County)
                        queryObject["address.component[County].value"] = advanced.address.$other[0].component.County;
                    if(advanced.address.$other[0].component.State)
                        queryObject["address.component[State].value"] = advanced.address.$other[0].component.State;
                    if(advanced.address.$other[0].component.Country)
                        queryObject["address.component[Country].value"] = advanced.address.$other[0].component.Country;
                    if(advanced.address.$other[0].component.StreetAddressLine)
                        queryObject["address.component[StreetAddressLine].value"] = advanced.address.$other[0].component.StreetAddressLine;
                }
                if(advanced.identifier)
                    queryObject["identifier.value"] = advanced.identifier;
                if(advanced.dateOfBirth.from)
                    queryObject["dateOfBirth"] = `>=${moment(advanced.dateOfBirth.from).format('YYYY-MM-DD')}`;
                if(advanced.dateOfBirth.to)
                    queryObject["dateOfBirth"] = `<=${moment(advanced.dateOfBirth.to).format('YYYY-MM-DD')}`;


            }
            else {
                // Build query and bind query to the search table
                var queryObject = {
                    "_e": Math.random(),
                    "_orderBy": "creationTime:desc",
                    "_any": $scope.search.val,
                    "_upstream": $scope.search._upstream
                };
            }
            $scope.$parent.lastSearch = {
                search: $scope.search
            };
            $scope.$parent.lastSearch.filter = $scope.filter = queryObject;


            try {
                $scope.$apply();
            } catch (e) { }
        }
        finally {
            SanteDB.display.buttonWait("#btnSearchSubmit", false);

        }
    }

    $scope.resetSearch = function() {
        $scope.search.advanced = {
            address: [new EntityAddress()],
            name: [new EntityName()],
            dateOfBirth : {}
        };
    }

    // Search if needed
    if ($scope.$parent.lastSearch) {
        $scope.filter = $scope.$parent.lastSearch.filter;
        $scope.search = $scope.$parent.lastSearch.search;

        if($scope.search._advanced)
            $('#searchCarousel').carousel(1);
    }
    else {
        // Current search 
        $scope.search = {
            val: $stateParams.q
        };

        $scope.resetSearch();
        $scope.search._advanced = false;

        if ($stateParams.q)
            $scope.searchMpi();
    }

    

    // Scan identifier but don't search
    $scope.scanIdentifier = async function() {
        
        SanteDB.display.buttonWait("#btnScanSecondary", true);
        try {
            $scope.search.advanced.identifier = await SanteDB.application.scanIdentifierAsync();
            try { $scope.$apply(); }
            catch(e) {}
        }
        catch(e) {
            $rootScope.errorHandler(e);
        }
        finally {
            SanteDB.display.buttonWait("#btnScanSecondary", false);
        }
    }
    // Scan 
    $scope.scanSearch = async function () {
        try {


            var result = await SanteDB.application.searchByBarcodeAsync();
            if (!result)
                return;
            else if (result.$type == "Bundle") {
                $scope.search.val = result.$search;
                $scope.searchMpi();
            }
            else {
                // now we want to redirect the state change
                // TODO: Have this change redirection based on type of the data
                if (SanteDB.application.callResourceViewer(result.$type, { id: result.id })) {
                    if (result.$novalidate)
                        toastr.warning(SanteDB.locale.getString(`ui.model.${result.$type}._code.validation`), null, {
                            preventDuplicates: true,
                            positionClass: "toast-bottom-center",
                            showDuration: 500,
                            hideDuration: 500,
                            timeout: "0",
                            extendedTimeout: "0"
                        });
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

    
    $('#searchCarousel').on('slide.bs.carousel', function () {
        $scope.search._advanced = !$scope.search._advanced;
        //delete($scope.search.advanced);

        try {
            $scope.$apply();
        } catch (e) { }
    });
}]);
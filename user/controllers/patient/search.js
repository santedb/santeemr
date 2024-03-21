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
angular.module('santedb').controller('EmrPatientSearchController', ["$scope", "$rootScope", "$state", "$timeout", "$stateParams", function ($scope, $rootScope, $state, $timeout, $stateParams) {
    // Initial view
    $scope.search = {
    };


    if($state.q) {
        $scope.search.value = q;
        $scope.search.upstream = $state.o;
        performSearch($scope.search);
    }

    // Perform the search and populate the results
    function performSearch(search, upstream) {
        $scope.filter = {
            _any : search.value, 
            _upstream : upstream,
            _viewModel : 'full',
            _orderBy: 'modifiedOn:desc'
        };
    }

    $scope.searchLocal = function(searchForm) {
        if(searchForm.$invalid) return;
        performSearch($scope.search);
    }

    $scope.searchOnline = function() {
        performSearch($scope.search, true);
    }
}])
// Advanced Search
// Search - By Demographics
.controller('EmrAdvancedPatientSearchController', [ "$scope", "$rootScope", "$state", "$timeout", "$stateParams", function($scope, $rootScope, $state, $timeout, $stateParams) {

    $scope.$watch("searchForm", function(n, o) {
        if(n && !o || n && n.$pristine && !n.$invalid) {
            n.$setValidity('insufficient', false);
        }
    })

    // Approximate fields
    var approxFunctions = {
        'name.component[Given].value' : (v, us) => [ `~${v}`, us ? `:(similarity_lev|${v})<2` : `:(levenshtein|${v})<2` ],
        'name.component[Family].value' : (v, us) => [ `~${v}`, us ? `:(similarity_lev|${v})<2` : `:(levenshtein|${v})<2` ],
        'relationship[type.conceptSet=d3692f40-1033-48ea-94cb-31fc0f352a4e].target.name.component[Given].value' : (v, us) => [ `~${v}`, `:(approx)${v}` ],
        'relationship[type.conceptSet=d3692f40-1033-48ea-94cb-31fc0f352a4e].target.name.component[Family].value' : (v, us) => [ `~${v}`, `:(approx)${v}` ],
        'address.component[AddressLine].value' : (v, us) => [ us ? `:(similarity_lev|${v})<2` : `:(levenshtein|${v})<2` ],
        'telecom.value': (v, us) => [ us ? `:(similarity_lev|${v})<2` : `:(levenshtein|${v})<2`,  `~${v}` ],
        'relationship[type.conceptSet=d3692f40-1033-48ea-94cb-31fc0f352a4e].target.address.component[AddressLine].value': (v, us) => [ us ?  `:(similarity_lev|${v})<2` : `:(levenshtein|${v})<2` ],
        'relationship[type.conceptSet=d3692f40-1033-48ea-94cb-31fc0f352a4e].target.telecom.value': (v, us) => [ us ? `:(similarity_lev|${v})<3` : `:(levenshtein|${v})<2`, `~${v}` ],
    };

    // Initial view
    $scope.search = {
    };

    $scope.$watch("search._expandAddressId", function(n, o) {
        if(n && n != o) {
            setAddressFilters(n, 'address.component');
        }
    });
    
    $scope.$watch("search._expandRelationshipAddressId", function(n, o) {
        if(n && n != o) {
            setAddressFilters(n, 'relationship[type.conceptSet=d3692f40-1033-48ea-94cb-31fc0f352a4e].target.address.component');
        }
    });

    // SEt address filters by the place id passed
    async function setAddressFilters(cityOrPlaceId, searchPath) {
        try {
            var placeResolution = await SanteDB.resources.place.getAsync(cityOrPlaceId, 'dropdown');
            if(placeResolution) {
                $timeout(() => {
                    var address = placeResolution.address.Direct || placeResolution.address.PhysicalVisit;
                    if(Array.isArray(address)) {
                        address = address[0];
                    }

                    $scope.search[`${searchPath}[State].value`] = address.component.State ? address.component.State[0] : null;
                    $scope.search[`${searchPath}[Country].value`] = address.component.Country ? address.component.Country[0] : null;
                    $scope.search[`${searchPath}[City].value`] = address.component.City ? address.component.City[0] : null;
                    $scope.search[`${searchPath}[County].value`] = address.component.County ? address.component.County[0] : null;

                    $scope.validateParameterCount();
                })
            }
        }
        catch(e) {
            console.error(e);
        }
    }

    function countFilterCriteria() {
        var nParameters = 0;

        if($scope.search['name.component[Given].value'] && $scope.search['name.component[Family].value']) // Name is one search field
            nParameters++;
        if($scope.search['search._expandAddressId'] || $scope.search['address.component[AddressLine].value']) 
            nParameters++;
        if($scope.search['genderConcept']) 
            nParameters++;
        if($scope.search['dateOfBirth'])
            nParameters++;
        if($scope.search['identifier.value'] || $scope.search['id']) 
            nParameters += 5; // Identifier is a known good search criteria
        if($scope.search['telecom.value'])
            nParameters++;
        if($scope.search['relationship[type.conceptSet=d3692f40-1033-48ea-94cb-31fc0f352a4e].target.name.component[Given].value'] && $scope.search['relationship[type.conceptSet=d3692f40-1033-48ea-94cb-31fc0f352a4e].target.name.component[Family].value']) 
            nParameters++;
        if($scope.search['relationship[type.conceptSet=d3692f40-1033-48ea-94cb-31fc0f352a4e].target.telecom.value'])
            nParameters++;
        if($scope.search['relationship[type.conceptSet=d3692f40-1033-48ea-94cb-31fc0f352a4e].target.identifier.value'] || $scope.search['relationship[type.conceptSet=d3692f40-1033-48ea-94cb-31fc0f352a4e].target']) 
            nParameters += 5;

        return nParameters;
    }

    function performSearch(searchCrtiteria, upstream) {
        $scope.validateParameterCount();
        $scope.filter = {
            _viewModel: 'full',
            _orderBy: 'modifiedOn:desc',
            _upstream: upstream
        };


        // Prepare the search parameters
        var searchObject = angular.copy($scope.search);
        Object.keys(searchObject)
            .filter(f=>!f.startsWith('_'))
            .forEach(f => {
                var value = searchObject[f];
                if(value === null || value === '') return;
                if(angular.isObject(value)) // Turn this into an array
                {
                    value = Object.keys(value).filter(v=>value[v]).map(v=>{
                        var subValue = value[v];
                        var op = v === '0' ? '>=' : v === '1' ? '<=' : '';
                        return subValue instanceof Date ? `${op}${moment(subValue).format('YYYY-MM-DD')}` : `${op}${subValue}`;
                    });
                }

                // HACK: Approximate date of birth
                if(searchObject._approxAge && f == 'dateOfBirth') {
                    value = value.map(v=>`:(age)${v}`);
                }

                if(approxFunctions[f]) {
                    $scope.filter[f] = approxFunctions[f](value);
                }
                else if(typeof value === Date) {
                    $scope.filter[f] = moment(value).format('YYY-MM-DD');
                }
                else {
                    $scope.filter[f] = value;
                }
            });


    }

    $scope.countFilterCriteria = countFilterCriteria;

    $scope.scanBarcode = async function(target) {
        try {
            var barcodeIdentifier = await SanteDB.application.scanIdentifierAsync();
            $timeout(() => {
                if(barcodeIdentifier.$type) { // This is a full object so set the search parameters based on the data within
                    if(target !== '') target += ".";

                    $scope.search[`${target}id`] = barcodeIdentifier.id;
                    performSearch();
                    // Find the first identifier 
                    if(barcodeIdentifier.identifier) {
                        var domain = Object.keys(barcodeIdentifier.identifier)[0];
                        $scope.search[`${target}identifier.value`] = barcodeIdentifier.identifier[domain][0].value;
                    }
                }
                else {
                    $scope.search[`${target}identifier.value`] = barcodeIdentifier;
                }
            })
        } catch(e){
            $rootScope.errorHandler(e);
        }

    }
    // Watch the form and any search criteria to see if there are sufficient inputs
    $scope.validateParameterCount = function()
    {
        var valid = countFilterCriteria() > 2;
        $scope.searchForm.$setValidity('insufficient', valid);
        return valid;
    }


    $scope.searchOnline = function() {
        if($scope.searchForm.$invalid && !$scope.validateParameterCount()) {
            return;
        }

        performSearch($scope.search, true);
    }
    $scope.searchLocal = function(searchForm) {
        if(searchForm.$invalid && !$scope.validateParameterCount()) {
            return;
        }

        performSearch($scope.search);
    }
}]);
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
angular.module('santedb').controller('LogIndexController', ["$scope", "$rootScope", "$timeout", "$compile", function ($scope, $rootScope, $timeout, $compile) {
 
    
    // Change handler for show option
    $scope.updateView = function() {
        dt.ajax.reload();
    }

    // Initial value 
    $scope.extern = 'false';
    var dt = $("#logInfoTable").DataTable({
        serverSide: true,
        buttons: [
            'reload'
        ],
        columns: [
            {
                data: 'name',
                orderable: true
            },
            {
                orderable: true,
                class: "d-none d-md-table-cell",
                render: function(d, t, r) {
                    return moment(r.modified).format(SanteDB.locale.dateFormats.full);
                }
            },
            {
                orderable: true,
                class: "d-none d-sm-table-cell",
                render: function(d, t, r) {
                    return (r.size / 1024).toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,') + " KB";
                }
            },
            {
                orderable: false,
                render: function(d, t, r, i) {
                    return `<a class="btn btn-primary" ui-sref="santedb-emr.system.logs.view({ id: '${r.name}' })"><i class="fas fa-eye"></i> <span
                    class="d-none d-md-inline"> {{ 'ui.action.view' | i18n }}</span></a>`;
                }
            }
        ],
        ajax: function (data, callback, settings) {

            var query = {
                _upstream: $scope.extern,
                _count: data.length,
                _offset: data.start
            };
            if (data.search.value.length > 0)
                query.name = `~${data.search.value}`;
            if (data.order.length > 0) {
                
                var colname = null;
                switch(data.order[0].column)
                {
                    case 0:
                        colname = "name";
                        break;
                    case 1:
                        colname = "modified";
                        break;
                    case 2: 
                        colname = "size";
                        break;
                }
                query["_orderBy"] = `${colname}:${data.order[0].dir}`;
            }

            SanteDB.application.getLogInfoAsync(null, query)
                .then(function (res) {
                    callback({
                        data: res.resource.map(function (item) {
                            return item;
                        }),
                        recordsTotal: undefined,
                        recordsFiltered: res.totalResults || res.size
                    });
                })
                .catch(function (err) { $rootScope.errorHandler(err) });
        },
        createdRow: function (r, d, i) {
            $compile(angular.element(r).contents())($scope);
            $scope.$digest()
        },
    });

    // Bind buttons
    var bindButtons = function () {
        dt.buttons().container().appendTo($('.col-md-6:eq(0)', dt.table().container()));
        if (dt.buttons().container().length == 0)
            $timeout(bindButtons, 100);
        
    };
    bindButtons();
 }]);
 
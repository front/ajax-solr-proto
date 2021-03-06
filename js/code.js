var Manager;
var FIELDS = ['tm_title'];
(function($) {
    $(function() {
        Manager = new AjaxSolr.Manager({
            //solrUrl: 'http://evolvingweb.ca/solr/reuters/'
            solrUrl: 'http://eu1.websolr.com/solr/26ef27d03f3/'
        });
        AjaxSolr.CurrentSearchWidget = AjaxSolr.AbstractWidget.extend({
            start: 0,
            afterRequest: function() {
                var self = this;
                var links = [];
                var q = this.manager.store.get('q').val();
                if (q != '*:*') {
                    links.push($('<a href="#"></a>').text('(x) ' + q).click(function() {
                        self.manager.store.get('q').val('*:*');
                        self.doRequest();
                        return false;
                    }));
                }
                if (links.length > 1) {
                    links.unshift($('<a href="#"></a>').text('remove all').click(function() {
                        self.manager.store.get('q').val('*:*');
                        self.manager.store.remove('fq');
                        self.doRequest();
                        return false;
                    }));
                }
                var fq = this.manager.store.values('fq');
                for (var i = 0, l = fq.length; i < l; i++) {
                    links.push($('<a href="#"></a>').text('(x) ' + fq[i]).click(self.removeFacet(fq[i])));
                }
                if (links.length) {
                    var $target = $(this.target);
                    $target.empty();
                    for (var i = 0, l = links.length; i < l; i++) {
                        $target.append($('<li></li>').append(links[i]));
                    }
                } else {
                    $(this.target).html('<li>Viewing all documents!</li>');
                }
            },
            removeFacet: function(facet) {
                var self = this;
                return function() {
                    if (self.manager.store.removeByValue('fq', facet)) {
                        self.doRequest();
                    }
                    return false;
                };
            }
        });
        Manager.addWidget(new AjaxSolr.CurrentSearchWidget({
            id: 'currentsearch',
            target: '#selection',
        }));
        AjaxSolr.AutocompleteWidget = AjaxSolr.AbstractTextWidget.extend({
            afterRequest: function() {
                $(this.target).find('input').unbind().removeData('events').val('');
                var self = this;
                var callback = function(response) {
                    var list = [];
                    for (var i = 0; i < self.fields.length; i++) {
                        var field = self.fields[i];
                        for (var facet in response.facet_counts.facet_fields[field]) {
                            list.push({
                                field: field,
                                value: facet,
                                label: facet + ' (' + response.facet_counts.facet_fields[field][facet] + ') - ' + field
                            });
                        }
                    }
                    self.requestSent = false;
                    $(self.target).find('input').autocomplete('destroy').autocomplete({
                        source: list,
                        select: function(event, ui) {
                            if (ui.item) {
                                self.requestSent = true;
                                if (self.manager.store.addByValue('fq', ui.item.field + ':' + AjaxSolr.Parameter.escapeValue(ui.item.value))) {
                                    self.doRequest();
                                }
                            }
                        }
                    });
                    // This has lower priority so that requestSent is set.
                    $(self.target).find('input').bind('keydown', function(e) {
                        if (self.requestSent === false && e.which == 13) {
                            var value = AjaxSolr.Parameter.escapeValue( $(this).val() );
                            if (value && self.set(value) ) {
                                self.doRequest();
                            }
                        }
                    });
                } // end callback
                var params = ['rows=0&facet=true&facet.limit=-1&facet.mincount=1&json.nl=map'];
                for (var i = 0; i < this.fields.length; i++) {
                    params.push('facet.field=' + this.fields[i]);
                }
                var values = this.manager.store.values('fq');
                for (var i = 0; i < values.length; i++) {
                    params.push('fq=' + encodeURIComponent(values[i]));
                }
                params.push('q=' + this.manager.store.get('q').val());
                $.getJSON(this.manager.solrUrl + 'select?' + params.join('&') + '&wt=json&json.wrf=?', {}, callback);
            }
        });
        Manager.addWidget(new AjaxSolr.AutocompleteWidget({
            id: 'text',
            target: '#search',
            fields: FIELDS
        }));
        AjaxSolr.ResultWidget = AjaxSolr.AbstractWidget.extend({
            init: function() {
                $(document).on('click', 'a.more', function() {
                    var $this = $(this),
                        span = $this.parent().find('span');
                    if (span.is(':visible')) {
                        span.hide();
                        $this.text('more');
                    } else {
                        span.show();
                        $this.text('less');
                    }
                    return false;
                });
            },
            beforeRequest: function() {
                $(this.target).html($('<img>').attr('src', 'images/ajax_loader.gif'));
            },
            afterRequest: function() {
                $(this.target).empty();
                for (var i = 0, l = this.manager.response.response.docs.length; i < l; i++) {
                    var doc = this.manager.response.response.docs[i];
                    $(this.target).append(this.template(doc));
                }
            },
            template: function(doc) {
                var snippet = '';
                var bodyText = doc["tm_body:value"][0];
                if (bodyText.length > 300) {
                    snippet += doc.ds_created + ' ' + bodyText.substring(0, 300);
                    snippet += '<span style="display:none;">' + bodyText.substring(300);
                    snippet += '</span> <a href="#" class="more">more</a>';
                } else {
                    snippet += doc.ds_created + ' ' + bodyText;
                }
                var output = '<div><h2>' + doc.tm_title + '</h2>';
                output += '<p id="links_' + doc.id + '" class="links"></p>';
                output += '<p>' + snippet + '</p></div>';
                return output;
            }
        });
        Manager.addWidget(new AjaxSolr.ResultWidget({
            id: 'result',
            target: '#docs'
        }));
        Manager.init();
        Manager.store.addByValue('q', '*:*');
        Manager.doRequest();
    });
})(jQuery);
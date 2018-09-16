class ID(object):
    def __init__(self, js_obj):
        self.user = js_obj["user"]
        self.server = js_obj["server"]

    def __repr__(self):
        return "<ID {0}>".format(str(self))

    def __str__(self):
        return "{0}@{1}".format(self.user, self.server)

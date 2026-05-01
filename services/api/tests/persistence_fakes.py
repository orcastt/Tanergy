from io import BytesIO


class FakeS3NotFound(Exception):
    response = {
        "Error": {"Code": "NoSuchKey"},
        "ResponseMetadata": {"HTTPStatusCode": 404},
    }


class FakeS3Client:
    def __init__(self):
        self.objects = {}

    def put_object(self, Body, Bucket, ContentType, Key):
        self.objects[(Bucket, Key)] = {"Body": Body, "ContentType": ContentType}

    def get_object(self, Bucket, Key):
        stored = self.objects.get((Bucket, Key))
        if not stored:
            raise FakeS3NotFound()
        return {"Body": BytesIO(stored["Body"]), "ContentType": stored["ContentType"]}


class FakePostgresCursor:
    def __init__(self, database):
        self.database = database
        self.row = None
        self.rows = []

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, traceback):
        return False

    def execute(self, query, params=None):
        normalized = " ".join(query.split())
        if normalized.startswith("INSERT INTO tangent_boards"):
            key = (params[1], params[0])
            self.database.boards[key] = params
        elif normalized.startswith("SELECT id, workspace_id, owner_id, title, document") and "ORDER BY saved_at DESC" in normalized:
            workspace_id = params[0]
            self.rows = [row for (workspace, _board_id), row in self.database.boards.items() if workspace == workspace_id]
            self.rows.sort(key=lambda row: row[9], reverse=True)
        elif normalized.startswith("SELECT id, workspace_id, owner_id, title, document"):
            self.row = self.database.boards.get((params[0], params[1]))
        elif normalized.startswith("UPDATE tangent_boards SET title"):
            key = (params[2], params[3])
            row = self.database.boards.get(key)
            if row:
                self.database.boards[key] = (
                    row[0],
                    row[1],
                    row[2],
                    params[0],
                    row[4],
                    row[5],
                    row[6],
                    row[7],
                    row[8],
                    params[1],
                )
        elif normalized.startswith("DELETE FROM tangent_boards"):
            self.database.boards.pop((params[0], params[1]), None)
        elif normalized.startswith("INSERT INTO tangent_assets"):
            key = (params[1], params[0])
            self.database.assets[key] = params
        elif normalized.startswith("SELECT id, workspace_id, created_by"):
            self.row = self.database.assets.get((params[0], params[1]))

    def fetchone(self):
        return self.row

    def fetchall(self):
        return self.rows


class FakePostgresConnection:
    def __init__(self, database):
        self.database = database
        self.commits = 0

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, traceback):
        return False

    def cursor(self):
        return FakePostgresCursor(self.database)

    def commit(self):
        self.commits += 1


class FakePostgresDatabase:
    def __init__(self):
        self.assets = {}
        self.boards = {}

    def connect(self):
        return FakePostgresConnection(self)

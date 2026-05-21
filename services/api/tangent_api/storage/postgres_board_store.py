from tangent_api.storage.postgres_board_store_boards import PostgresBoardStoreBoardsMixin
from tangent_api.storage.postgres_board_store_members import PostgresBoardStoreMembersMixin
from tangent_api.storage.postgres_board_store_mutations import PostgresBoardStoreMutationsMixin
from tangent_api.storage.postgres_board_store_shares import PostgresBoardStoreSharesMixin
from tangent_api.storage.postgres_board_store_support import PostgresBoardStoreAccessMixin
from tangent_api.storage.postgres_connection import connect_to_postgres


class PostgresBoardStore(
    PostgresBoardStoreAccessMixin,
    PostgresBoardStoreBoardsMixin,
    PostgresBoardStoreMutationsMixin,
    PostgresBoardStoreMembersMixin,
    PostgresBoardStoreSharesMixin,
):
    pass
